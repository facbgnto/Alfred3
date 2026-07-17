import { env } from '../config/env.js';
import type { ChatChunk, ChatRequest, ProviderHealth } from '../types/voice.js';
import { OllamaError } from './voice/errors.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type ChatResult = {
  content: string;
  model: string;
  fallbackUsed: boolean;
  durationMs: number;
};

function timeoutController(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref();

  if (parent) {
    parent.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return { controller, done: () => clearTimeout(timeout) };
}

function modelForChannel(channel = 'desktop') {
  return channel === 'voice' ? env.OLLAMA_VOICE_MODEL : env.OLLAMA_CHAT_MODEL;
}

async function postChat(messages: ChatMessage[], model: string, signal?: AbortSignal) {
  const { controller, done } = timeoutController(env.OLLAMA_TIMEOUT_MS, signal);
  try {
    return await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        keep_alive: env.OLLAMA_KEEP_ALIVE,
        options: {
          temperature: 0.3,
          num_ctx: env.OLLAMA_NUM_CTX,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    done();
  }
}

export async function chatWithMetrics(messages: ChatMessage[], channel = 'desktop', signal?: AbortSignal): Promise<ChatResult> {
  const primaryModel = modelForChannel(channel);
  const models = primaryModel === env.OLLAMA_FALLBACK_MODEL
    ? [primaryModel]
    : [primaryModel, env.OLLAMA_FALLBACK_MODEL];

  let lastError: unknown;
  const startedAt = performance.now();
  for (const model of models) {
    try {
      const response = await postChat(messages, model, signal);
      if (!response.ok) {
        lastError = new Error(`Ollama respondio ${response.status} con ${model}`);
        continue;
      }

      const data = await response.json() as { message?: { content?: string } };
      return {
        content: data.message?.content?.trim() || 'No pude generar una respuesta.',
        model,
        fallbackUsed: model !== primaryModel,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new OllamaError(
    lastError instanceof Error ? lastError.message : 'Ollama no esta disponible.',
    true,
  );
}

export async function chat(messages: ChatMessage[], channel = 'desktop', signal?: AbortSignal) {
  const result = await chatWithMetrics(messages, channel, signal);
  return result.content;
}

export async function* chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
  const model = modelForChannel(request.channel);
  const { controller, done } = timeoutController(env.OLLAMA_TIMEOUT_MS, request.signal);
  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages,
      stream: true,
      keep_alive: env.OLLAMA_KEEP_ALIVE,
      options: {
        temperature: 0.3,
        num_ctx: env.OLLAMA_NUM_CTX,
      },
    }),
    signal: controller.signal,
  }).finally(done);

  if (!response.ok || !response.body) {
    throw new OllamaError(`Ollama streaming respondio ${response.status}.`, true);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const payload = JSON.parse(line) as { message?: { content?: string }; done?: boolean; model?: string };
      yield {
        requestId: request.requestId,
        content: payload.message?.content ?? '',
        done: Boolean(payload.done),
        model: payload.model ?? model,
      };
    }
  }
}

export async function ollamaHealth(): Promise<ProviderHealth> {
  const startedAt = performance.now();
  try {
    const { controller, done } = timeoutController(Math.min(env.OLLAMA_TIMEOUT_MS, 3000));
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    }).finally(done);

    return {
      status: response.ok ? 'ok' : 'unavailable',
      provider: 'ollama',
      model: env.OLLAMA_CHAT_MODEL,
      url: env.OLLAMA_BASE_URL,
      latencyMs: Math.round(performance.now() - startedAt),
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      provider: 'ollama',
      model: env.OLLAMA_CHAT_MODEL,
      url: env.OLLAMA_BASE_URL,
      error: error instanceof Error ? error.message : 'Ollama no disponible',
    };
  }
}
