import { env } from '../../../config/env.js';
import type { ProviderHealth } from '../../../types/voice.js';
import { eventBus } from '../../../core/eventBus.js';
import { TtsError } from '../errors.js';

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

type WavPcm = { channels: number; sampleRate: number; bitsPerSample: number; data: Buffer };

function parseWav(buffer: Buffer): WavPcm | undefined {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return undefined;
  }

  let offset = 12;
  let fmt: { channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  let data: Buffer | undefined;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > buffer.length) break;

    if (chunkId === 'fmt ') {
      fmt = {
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === 'data') {
      data = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!fmt || !data) return undefined;
  return { ...fmt, data };
}

function buildWavHeader(dataSize: number, pcm: Pick<WavPcm, 'channels' | 'sampleRate' | 'bitsPerSample'>): Buffer {
  const { channels, sampleRate, bitsPerSample } = pcm;
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return header;
}

function normalizeWav(buffer: Buffer): Buffer | undefined {
  const wav = parseWav(buffer);
  if (!wav || wav.data.length === 0) return undefined;
  return Buffer.concat([buildWavHeader(wav.data.length, wav), wav.data]);
}

/**
 * Sintetiza una sola oracion y la emite por el eventBus (-> WS) apenas esta lista,
 * sin esperar a que el resto de la respuesta termine de generarse.
 */
export async function speakSentence(
  sentence: string,
  index: number,
  context: { requestId: string; signal?: AbortSignal },
): Promise<void> {
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

  const payload = await response.json().catch(() => ({}));
  const audio = payload.audioBase64 ? normalizeWav(Buffer.from(payload.audioBase64, 'base64')) : undefined;
  rememberPhrase(sentence);

  if (audio) {
    eventBus.emit('tts.audio', {
      requestId: context.requestId,
      index,
      audioBase64: audio.toString('base64'),
      mimeType: payload.audioMimeType ?? 'audio/wav',
    });
  }
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
