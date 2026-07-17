import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { processMessage } from '../core/assistant.js';
import { getAgent, listAgents } from '../core/agents.js';
import { stateMachine } from '../core/stateMachine.js';
import { dbHealth } from '../services/db.js';
import { chatStream, ollamaHealth } from '../services/ollama.js';
import { voiceDiagnostics } from '../services/voice/diagnostics.js';
import { voiceErrorResponse } from '../services/voice/errors.js';
import { getSttProviders, sttHealth, transcribeAudio } from '../services/voice/sttClient.js';
import { cancelVoiceTurn, processVoiceTurn } from '../services/voice/voiceOrchestrator.js';
import { clearConversationMemory, getConversationContext } from '../services/memory/localMemory.js';
import { clearTraces, listTraces } from '../services/traces/traceStore.js';
import { executeTool, listTools } from '../services/tools/registry.js';
import { getSkills } from '../skills/registry.js';

const voiceStateSchema = z.enum([
  'offline',
  'idle',
  'waiting-wake-word',
  'wake_listening',
  'listening',
  'processing',
  'transcribing',
  'thinking',
  'executing',
  'speaking',
  'interrupted',
  'error',
]);

function sendVoiceError(reply: FastifyReply, error: unknown) {
  const response = voiceErrorResponse(error);
  return reply.code(response.statusCode).send(response.body);
}

export async function httpRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const [database, ollama, stt] = await Promise.all([
      dbHealth(),
      ollamaHealth(),
      sttHealth(),
    ]);

    return {
      ok: Boolean(database) && ollama.status === 'ok',
      state: stateMachine.get(),
      services: {
        database,
        ollama,
        stt,
      },
    };
  });

  app.get('/api/status', async () => ({
    name: 'ALFRED',
    version: '3.0.0',
    state: stateMachine.get(),
    skills: getSkills(),
  }));

  app.post('/api/chat', async (req, reply) => {
    const parsed = z
      .object({
        message: z.string().min(1),
        channel: z.enum(['desktop', 'voice']).default('desktop'),
        agentId: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      return {
        response: await processMessage(
          parsed.data.message,
          parsed.data.channel,
          parsed.data.agentId,
        ),
      };
    } catch (error) {
      req.log.error(error);
      if (error instanceof Error && error.message.startsWith('Agente desconocido')) {
        return reply.code(400).send({ error: error.message });
      }
      return reply.code(503).send({
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  });

  app.post('/api/chat/stream', async (req, reply) => {
    const parsed = z
      .object({
        message: z.string().min(1),
        channel: z.enum(['desktop', 'voice']).default('desktop'),
        agentId: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    const requestId = crypto.randomUUID();
    try {
      const agent = getAgent(parsed.data.agentId, parsed.data.channel);
      for await (const chunk of chatStream({
        requestId,
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: parsed.data.message },
        ],
        channel: parsed.data.channel,
      })) {
        reply.raw.write(`event: token\ndata: ${JSON.stringify(chunk)}\n\n`);
      }
      reply.raw.write(`event: done\ndata: ${JSON.stringify({ requestId })}\n\n`);
    } catch (error) {
      const status = error instanceof Error && error.message.startsWith('Agente desconocido')
        ? 'bad-request'
        : 'stream-error';
      reply.raw.write(`event: error\ndata: ${JSON.stringify({
        requestId,
        message: error instanceof Error ? error.message : status,
      })}\n\n`);
    } finally {
      reply.raw.end();
    }
  });

  app.get('/api/voice/providers', async () => ({
    stt: getSttProviders(),
    tts: {
      active: 'pyttsx3',
      providers: ['pyttsx3'],
      fallbackEnabled: false,
    },
  }));

  app.get('/api/voice/health', async () => voiceDiagnostics());

  app.get('/api/voice/health/stt', async () => sttHealth());

  app.get('/api/voice/health/ollama', async () => ollamaHealth());

  app.get('/api/voice/health/tts', async () => (await voiceDiagnostics()).services.tts);

  app.get('/api/voice/diagnostics', async () => voiceDiagnostics());

  app.post('/api/voice/transcribe', async (req, reply) => {
    try {
      let audio: Buffer;
      let filename = 'audio.wav';
      let mimeType = req.headers['content-type'] ?? 'audio/wav';

      if (Buffer.isBuffer(req.body)) {
        audio = req.body;
      } else {
        const parsed = z
          .object({
            audioBase64: z.string().min(1),
            filename: z.string().optional(),
            mimeType: z.string().optional(),
          })
          .safeParse(req.body);

        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: {
              code: 'INVALID_AUDIO',
              message: 'Envie audio crudo o JSON con audioBase64.',
              retryable: false,
            },
          });
        }

        audio = Buffer.from(parsed.data.audioBase64, 'base64');
        filename = parsed.data.filename ?? filename;
        mimeType = parsed.data.mimeType ?? mimeType;
      }

      const transcript = await transcribeAudio(audio, { filename, mimeType });
      return { success: true, transcript };
    } catch (error) {
      req.log.error(error);
      return sendVoiceError(reply, error);
    }
  });

  app.post('/api/voice/process', async (req, reply) => {
    try {
      if (Buffer.isBuffer(req.body)) {
        return await processVoiceTurn({
          kind: 'audio',
          audio: req.body,
          mimeType: req.headers['content-type'] ?? 'audio/wav',
        });
      }

      const parsed = z
        .object({
          text: z.string().optional(),
          audioBase64: z.string().optional(),
          filename: z.string().optional(),
          mimeType: z.string().optional(),
          sessionId: z.string().optional(),
        })
        .refine(value => Boolean(value.text || value.audioBase64), {
          message: 'Envie text o audioBase64.',
        })
        .safeParse(req.body);

      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      if (parsed.data.audioBase64) {
        return await processVoiceTurn({
          kind: 'audio',
          audio: Buffer.from(parsed.data.audioBase64, 'base64'),
          filename: parsed.data.filename,
          mimeType: parsed.data.mimeType,
          sessionId: parsed.data.sessionId,
        });
      }

      return await processVoiceTurn({
        kind: 'text',
        text: parsed.data.text ?? '',
        sessionId: parsed.data.sessionId,
      });
    } catch (error) {
      req.log.error(error);
      return sendVoiceError(reply, error);
    }
  });

  app.post('/api/voice/cancel', async (req, reply) => {
    const parsed = z.object({ reason: z.string().optional() }).safeParse(req.body ?? {});
    const session = await cancelVoiceTurn(parsed.success ? parsed.data.reason : 'manual-cancel');
    return reply.send({ ok: true, cancelled: Boolean(session), requestId: session?.requestId });
  });

  app.get('/api/memory', async () => getConversationContext());

  app.delete('/api/memory', async () => clearConversationMemory());

  app.get('/api/agents', async () => ({ agents: listAgents() }));

  app.get('/api/traces', async (req, reply) => {
    const parsed = z
      .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
      .safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { traces: await listTraces(parsed.data.limit) };
  });

  app.delete('/api/traces', async () => clearTraces());

  app.get('/api/tools', async () => ({ tools: listTools() }));

  app.post('/api/tools/:name', async (req, reply) => {
    const params = z.object({ name: z.string().min(1) }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: params.error.flatten() });
    const result = await executeTool(params.data.name, req.body ?? {}, {
      requestId: 'manual',
      sessionId: 'manual',
    });
    return reply.code(result.success ? 200 : 400).send(result);
  });

  app.post('/api/voice/transcript', async (req, reply) => {
    const parsed = z
      .object({ text: z.string().min(1) })
      .safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: 'Texto invalido' });
    }

    try {
      return {
        response: await processMessage(parsed.data.text, 'voice'),
      };
    } catch (error) {
      req.log.error(error);
      return reply.code(503).send({
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  });

  app.post('/api/voice/state', async (req, reply) => {
    const parsed = z
      .object({
        state: voiceStateSchema,
        reason: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    stateMachine.set(parsed.data.state, parsed.data.reason);
    return { ok: true, state: stateMachine.get() };
  });
}
