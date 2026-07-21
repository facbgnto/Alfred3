import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env.js';
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
import { listProviders, synthesizeSpeech, clearAudioCache } from '../services/voice/VoiceManager.js';
import { voiceSettingsStore, type VoiceSettings } from '../services/voice/settingsStore.js';
import { getMetricsHistory, metricsSummary } from '../services/voice/metricsHistory.js';
import { voiceModePresets } from '../services/voice/config.js';

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

// Limite mas estricto para rutas que golpean STT/TTS/LLM (CPU/red/costo), por
// encima del limite global registrado en server.ts.
const expensiveRateLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };
const settingsRateLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

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

  app.post('/api/chat', expensiveRateLimit, async (req, reply) => {
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

  app.get('/api/voice/providers', async () => {
    const settings = voiceSettingsStore.get();
    return {
      stt: getSttProviders(),
      tts: {
        active: settings.ttsProvider,
        fallback: settings.ttsFallbackProvider,
        providers: listProviders(),
      },
    };
  });

  app.get('/api/voice/health', async () => voiceDiagnostics());

  app.get('/api/voice/health/stt', async () => sttHealth());

  app.get('/api/voice/health/ollama', async () => ollamaHealth());

  app.get('/api/voice/health/tts', async () => (await voiceDiagnostics()).services.tts);

  app.get('/api/voice/diagnostics', async () => voiceDiagnostics());

  app.get('/api/voice/metrics', async (req, reply) => {
    const parsed = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { summary: metricsSummary(), recent: getMetricsHistory(parsed.data.limit) };
  });

  app.get('/api/voice/voices', async () => {
    const settings = voiceSettingsStore.get();
    return {
      active: { provider: settings.ttsProvider, voiceId: settings.ttsVoice },
      // Piper/pyttsx3 corren en el servicio local: la voz efectiva la decide ese
      // proceso (modelo .onnx presente o fallback del sistema operativo).
      piper: [{ id: env.VOICE_TTS_VOICE, label: 'Voz local (Piper/pyttsx3)' }],
      openai: env.OPENAI_TTS_VOICE ? [{ id: env.OPENAI_TTS_VOICE, label: env.OPENAI_TTS_VOICE }] : [],
      elevenlabs: env.ELEVENLABS_VOICE_ID ? [{ id: env.ELEVENLABS_VOICE_ID, label: env.ELEVENLABS_VOICE_ID }] : [],
      cartesia: env.CARTESIA_VOICE_ID ? [{ id: env.CARTESIA_VOICE_ID, label: env.CARTESIA_VOICE_ID }] : [],
      kokoro: [{ id: env.VOICE_TTS_VOICE, label: env.VOICE_TTS_VOICE }],
      xtts: env.XTTS_SPEAKER_ID ? [{ id: env.XTTS_SPEAKER_ID, label: 'Muestra autorizada' }] : [],
    };
  });

  const voiceSettingsSchema = z.object({
    enabled: z.boolean().optional(),
    ttsProvider: z.enum(['piper', 'pyttsx3', 'openai', 'elevenlabs', 'cartesia', 'kokoro', 'xtts']).optional(),
    ttsFallbackProvider: z.enum(['piper', 'pyttsx3', 'openai', 'elevenlabs', 'cartesia', 'kokoro', 'xtts']).optional(),
    ttsVoice: z.string().min(1).optional(),
    ttsSpeed: z.coerce.number().min(0.5).max(2).optional(),
    ttsLanguage: z.string().min(2).optional(),
    mode: z.enum(Object.keys(voiceModePresets) as [keyof typeof voiceModePresets, ...Array<keyof typeof voiceModePresets>]).optional(),
    cacheEnabled: z.boolean().optional(),
    continuousConversation: z.boolean().optional(),
    bargeInEnabled: z.boolean().optional(),
    volume: z.coerce.number().min(0).max(1).optional(),
  });

  app.get('/api/voice/settings', async () => voiceSettingsStore.get());

  app.put('/api/voice/settings', settingsRateLimit, async (req, reply) => {
    const parsed = voiceSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (parsed.data.cacheEnabled === false) clearAudioCache();
    return voiceSettingsStore.update(parsed.data as Partial<VoiceSettings>);
  });

  const previewText = 'Hola Felipe. Soy Alfred. Mi sistema de voz esta funcionando correctamente y estoy listo para ayudarte.';

  app.post('/api/voice/preview', expensiveRateLimit, async (req, reply) => {
    const parsed = z.object({ text: z.string().min(1).max(1000).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = await synthesizeSpeech(parsed.data.text ?? previewText, { requestId: 'preview' });
      return {
        ok: true,
        provider: result.provider,
        cacheHit: result.cacheHit,
        audioBase64: result.audio.toString('base64'),
        audioMimeType: result.mimeType,
      };
    } catch (error) {
      req.log.error(error);
      return sendVoiceError(reply, error);
    }
  });

  app.post('/api/voice/synthesize', expensiveRateLimit, async (req, reply) => {
    const parsed = z.object({ text: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = await synthesizeSpeech(parsed.data.text, { requestId: 'manual-synthesize' });
      return {
        ok: true,
        provider: result.provider,
        cacheHit: result.cacheHit,
        audioBase64: result.audio.toString('base64'),
        audioMimeType: result.mimeType,
      };
    } catch (error) {
      req.log.error(error);
      return sendVoiceError(reply, error);
    }
  });

  app.post('/api/voice/transcribe', expensiveRateLimit, async (req, reply) => {
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

  app.post('/api/voice/process', expensiveRateLimit, async (req, reply) => {
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
