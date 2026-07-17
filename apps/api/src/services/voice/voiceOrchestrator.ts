import { eventBus } from '../../core/eventBus.js';
import { getAgent } from '../../core/agents.js';
import { chat, chatStream } from '../ollama.js';
import { appendConversation, getConversationContext } from '../memory/localMemory.js';
import { appendTrace } from '../traces/traceStore.js';
import { executeTool } from '../tools/registry.js';
import { transcribeAudio } from './sttClient.js';
import { voiceSessionManager } from './session/voiceSessionManager.js';
import { cancelTts, speakText } from './tts/ttsClient.js';

type ProcessVoiceInput =
  | { kind: 'text'; text: string; sessionId?: string }
  | { kind: 'audio'; audio: Buffer; filename?: string; mimeType?: string; sessionId?: string };

const stopCommands = [/^(alfred,\s*)?(detente|silencio|cancela|para)\.?$/i];

function isStopCommand(text: string) {
  return stopCommands.some(pattern => pattern.test(text.trim()));
}

function systemPrompt(memorySummary: string) {
  const agent = getAgent('voice_companion', 'voice');
  return [
    agent.systemPrompt,
    agent.allowedTools.length ? `Herramientas permitidas: ${agent.allowedTools.join(', ')}.` : '',
    memorySummary ? `Resumen de memoria local:\n${memorySummary}` : '',
  ].filter(Boolean).join('\n\n');
}

export async function processVoiceTurn(input: ProcessVoiceInput) {
  const session = voiceSessionManager.start(input.sessionId);
  eventBus.emit('voice.listening.started', {
    requestId: session.requestId,
    sessionId: session.sessionId,
  });

  try {
    let text: string;
    if (input.kind === 'audio') {
      voiceSessionManager.setState(session.requestId, 'transcribing', 'audio-received');
      const sttStarted = performance.now();
      const transcript = await transcribeAudio(input.audio, {
        filename: input.filename,
        mimeType: input.mimeType,
      });
      voiceSessionManager.markMetric(session.requestId, 'sttLatencyMs', performance.now() - sttStarted);
      text = transcript.text;
      eventBus.emit('stt.completed', { requestId: session.requestId, transcript });
    } else {
      text = input.text.trim();
    }

    if (!text) {
      voiceSessionManager.complete(session.requestId);
      return { requestId: session.requestId, text: '', response: '' };
    }

    if (isStopCommand(text)) {
      await cancelVoiceTurn('stop-command');
      return { requestId: session.requestId, text, response: 'De acuerdo.' };
    }

    await appendConversation('user', text);
    const memory = await getConversationContext();
    const messages = [
      { role: 'system' as const, content: systemPrompt(memory.summary) },
      ...memory.recent.slice(-10).map(entry => ({
        role: entry.role,
        content: entry.content,
      })),
      { role: 'user' as const, content: text },
    ];

    voiceSessionManager.setState(session.requestId, 'thinking', 'ollama-processing');
    const llmStarted = performance.now();
    let firstTokenMarked = false;
    let responseText = '';
    let responseModel = 'unknown';

    try {
      for await (const chunk of chatStream({
        requestId: session.requestId,
        sessionId: session.sessionId,
        messages,
        channel: 'voice',
        signal: session.abortController.signal,
      })) {
        if (!voiceSessionManager.isActive(session.requestId)) break;
        if (chunk.content) {
          if (!firstTokenMarked) {
            firstTokenMarked = true;
            voiceSessionManager.markMetric(session.requestId, 'llmFirstTokenMs', performance.now() - llmStarted);
          }
          responseText += chunk.content;
          responseModel = chunk.model;
          eventBus.emit('llm.token', {
            requestId: session.requestId,
            token: chunk.content,
          });
        }
      }
    } catch {
      responseText = await chat(messages, 'voice', session.abortController.signal);
    }

    const llmTotalMs = performance.now() - llmStarted;
    voiceSessionManager.markMetric(session.requestId, 'llmTotalMs', llmTotalMs);
    eventBus.emit('llm.completed', { requestId: session.requestId, text: responseText });

    if (/estado del sistema|estado local|recursos/i.test(text)) {
      const toolResult = await executeTool('system.status', {}, {
        requestId: session.requestId,
        sessionId: session.sessionId,
      });
      eventBus.emit('tool.result', { requestId: session.requestId, tool: 'system.status', result: toolResult });
    }

    await appendConversation('assistant', responseText);
    await appendTrace({
      kind: 'assistant.turn',
      requestId: session.requestId,
      sessionId: session.sessionId,
      channel: 'voice',
      agentId: 'voice_companion',
      model: responseModel,
      durationMs: Math.round(llmTotalMs),
      success: true,
      input: { message: text },
      output: { text: responseText },
      metadata: { mode: 'continuous' },
    });

    if (voiceSessionManager.isActive(session.requestId)) {
      voiceSessionManager.setState(session.requestId, 'speaking', 'tts-speaking');
      await speakText(responseText, {
        requestId: session.requestId,
        signal: session.abortController.signal,
      });
    }

    voiceSessionManager.complete(session.requestId);
    return { requestId: session.requestId, text, response: responseText };
  } catch (error) {
    if (session.abortController.signal.aborted) {
      return { requestId: session.requestId, text: '', response: '', cancelled: true };
    }
    voiceSessionManager.setState(session.requestId, 'error', error instanceof Error ? error.message : 'voice-error');
    throw error;
  }
}

export async function cancelVoiceTurn(reason = 'manual-cancel') {
  const session = voiceSessionManager.cancel(reason);
  if (session) {
    await cancelTts(session.requestId);
    eventBus.emit('llm.cancelled', { requestId: session.requestId, reason });
  }
  return session;
}
