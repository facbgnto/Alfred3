import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { eventBus } from './eventBus.js';
import { stateMachine } from './stateMachine.js';
import { getAgent } from './agents.js';
import { chatWithMetrics } from '../services/ollama.js';
import { appendConversation, getConversationContext } from '../services/memory/localMemory.js';
import { appendTrace } from '../services/traces/traceStore.js';

export async function processMessage(message: string, channel = 'desktop', agentId?: string) {
  const clean = message.trim();
  if (!clean) throw new Error('Mensaje vacio');

  const lower = clean.toLowerCase();
  if (/^(hola|alfred|buenos dias|buenas tardes|buenas noches)[.! ]*$/.test(lower)) {
    return `A su servicio, ${env.ALFRED_ADDRESS}.`;
  }

  const requestId = randomUUID();
  const agent = getAgent(agentId, channel);
  stateMachine.set('thinking');
  eventBus.emit('assistant.request.received', { requestId, message: clean, channel, agentId: agent.id });

  try {
    if (agent.memoryEnabled) {
      await appendConversation('user', clean);
    }
    const memory = agent.memoryEnabled ? await getConversationContext() : { recent: [], summary: '' };
    const messages = [
      {
        role: 'system' as const,
        content: [
          `${agent.systemPrompt} Tratas al usuario como "${env.ALFRED_ADDRESS}".`,
          memory.summary ? `Memoria resumida:\n${memory.summary}` : '',
          agent.allowedTools.length ? `Herramientas permitidas por este agente: ${agent.allowedTools.join(', ')}.` : '',
        ].filter(Boolean).join('\n\n'),
      },
      ...memory.recent.slice(-10).map(entry => ({
        role: entry.role,
        content: entry.content,
      })),
      ...(agent.memoryEnabled ? [] : [{ role: 'user' as const, content: clean }]),
    ];
    const result = await chatWithMetrics(messages, channel);
    if (agent.memoryEnabled) {
      await appendConversation('assistant', result.content);
    }
    await appendTrace({
      kind: 'assistant.turn',
      requestId,
      channel,
      agentId: agent.id,
      model: result.model,
      durationMs: result.durationMs,
      success: true,
      input: { message: clean },
      output: { text: result.content },
      metadata: { fallbackUsed: result.fallbackUsed, mode: agent.mode },
    });
    eventBus.emit('assistant.response', { requestId, text: result.content, channel, agentId: agent.id });
    return result.content;
  } catch (error) {
    await appendTrace({
      kind: 'assistant.turn',
      requestId,
      channel,
      agentId: agent.id,
      success: false,
      input: { message: clean },
      error: error instanceof Error ? error.message : 'assistant-error',
      metadata: { mode: agent.mode },
    });
    throw error;
  } finally {
    stateMachine.set(channel === 'voice' ? 'wake_listening' : 'idle');
  }
}
