import { env } from '../../../config/env.js';
import type { ProviderHealth } from '../../../types/voice.js';
import { eventBus } from '../../../core/eventBus.js';
import { voiceSessionManager } from '../session/voiceSessionManager.js';
import { voiceSettingsStore } from '../settingsStore.js';
import { synthesizeSpeech, cancelSpeech, voiceProviderHealth } from '../VoiceManager.js';

export async function ttsHealth(): Promise<ProviderHealth> {
  const provider = voiceSettingsStore.get().ttsProvider;
  const startedAt = performance.now();
  const health = await voiceProviderHealth(provider);
  return {
    status: health.ok ? 'ok' : 'unavailable',
    provider,
    latencyMs: health.latencyMs ?? Math.round(performance.now() - startedAt),
    model: env.VOICE_TTS_VOICE,
    error: health.detail,
  };
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
  if (context.signal?.aborted) return;

  const startedAt = performance.now();
  const result = await synthesizeSpeech(sentence, { requestId: context.requestId, signal: context.signal });

  if (index === 0) {
    voiceSessionManager.markMetric(context.requestId, 'ttsFirstAudioMs', performance.now() - startedAt);
  }
  voiceSessionManager.markMetric(context.requestId, 'ttsProvider', result.provider);
  voiceSessionManager.markMetric(context.requestId, 'cacheHit', result.cacheHit);
  if (result.fallbackUsed) voiceSessionManager.markMetric(context.requestId, 'fallbackUsed', true);

  eventBus.emit('tts.chunk', { requestId: context.requestId, text: sentence, cacheHit: result.cacheHit });
  eventBus.emit('tts.audio', {
    requestId: context.requestId,
    index,
    audioBase64: result.audio.toString('base64'),
    mimeType: result.mimeType,
  });
}

export async function cancelTts(requestId: string) {
  await cancelSpeech(requestId);
}
