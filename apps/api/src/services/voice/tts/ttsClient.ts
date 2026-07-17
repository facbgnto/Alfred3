import { env } from '../../../config/env.js';
import type { ProviderHealth } from '../../../types/voice.js';
import { eventBus } from '../../../core/eventBus.js';
import { TtsError } from '../errors.js';
import { splitIntoSpeakableSentences } from './sentenceSplitter.js';

type CachedPhrase = {
  expiresAt: number;
};

const phraseCache = new Map<string, CachedPhrase>();
const cacheTtlMs = 10 * 60 * 1000;
const maxCacheEntries = 64;

function timeoutSignal(timeoutMs: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref();
  if (parent) parent.addEventListener('abort', () => controller.abort(), { once: true });
  return controller.signal;
}

function rememberPhrase(text: string) {
  phraseCache.set(text, { expiresAt: Date.now() + cacheTtlMs });
  while (phraseCache.size > maxCacheEntries) {
    const firstKey = phraseCache.keys().next().value;
    if (!firstKey) break;
    phraseCache.delete(firstKey);
  }
}

function cacheHit(text: string) {
  const item = phraseCache.get(text);
  if (!item) return false;
  if (Date.now() > item.expiresAt) {
    phraseCache.delete(text);
    return false;
  }
  return true;
}

export async function ttsHealth(): Promise<ProviderHealth> {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${env.VOICE_SERVICE_URL}/tts/health`, {
      signal: timeoutSignal(3000),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      return {
        status: 'degraded',
        provider: env.VOICE_TTS_PROVIDER,
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    }
    const payload = await response.json().catch(() => ({}));
    return {
      status: 'ok',
      provider: String(payload.provider ?? env.VOICE_TTS_PROVIDER),
      model: String(payload.voice ?? env.VOICE_TTS_VOICE),
      latencyMs,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      provider: env.VOICE_TTS_PROVIDER,
      error: error instanceof Error ? error.message : 'TTS no disponible',
    };
  }
}

export async function speakText(
  text: string,
  context: { requestId: string; signal?: AbortSignal },
) {
  const sentences = splitIntoSpeakableSentences(text);
  const startedAt = performance.now();
  let firstAudioMarked = false;

  for (const sentence of sentences) {
    if (context.signal?.aborted) throw new TtsError('TTS cancelado.', true);
    const hit = cacheHit(sentence);
    eventBus.emit('tts.chunk', { requestId: context.requestId, text: sentence, cacheHit: hit });

    const response = await fetch(`${env.VOICE_SERVICE_URL}/tts/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: sentence,
        voice: env.VOICE_TTS_VOICE,
        speed: env.VOICE_TTS_SPEED,
      }),
      signal: timeoutSignal(30000, context.signal),
    });

    if (!response.ok) {
      throw new TtsError(`TTS respondio HTTP ${response.status}.`, true);
    }

    rememberPhrase(sentence);
    if (!firstAudioMarked) {
      firstAudioMarked = true;
      eventBus.emit('tts.started', {
        requestId: context.requestId,
        ttsFirstAudioMs: Math.round(performance.now() - startedAt),
      });
    }
  }

  eventBus.emit('tts.completed', {
    requestId: context.requestId,
    ttsTotalMs: Math.round(performance.now() - startedAt),
  });
}

export async function cancelTts(requestId: string) {
  await fetch(`${env.VOICE_SERVICE_URL}/tts/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId }),
    signal: timeoutSignal(3000),
  }).catch(() => undefined);
  eventBus.emit('tts.cancelled', { requestId });
}
