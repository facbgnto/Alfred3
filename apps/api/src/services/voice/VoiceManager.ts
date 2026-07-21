import { env } from '../../config/env.js';
import { eventBus } from '../../core/eventBus.js';
import { TtsError } from './errors.js';
import { normalizeForSpeech } from './tts/textNormalizer.js';
import { audioCacheKey, AudioCache } from './tts/audioCache.js';
import { voiceSettingsStore } from './settingsStore.js';
import { PiperVoiceProvider, cancelPiper } from './providers/PiperVoiceProvider.js';
import { OpenAIVoiceProvider } from './providers/OpenAIVoiceProvider.js';
import { ElevenLabsVoiceProvider } from './providers/ElevenLabsVoiceProvider.js';
import { CartesiaVoiceProvider } from './providers/CartesiaVoiceProvider.js';
import { KokoroVoiceProvider } from './providers/KokoroVoiceProvider.js';
import { XTTSVoiceProvider } from './providers/XTTSVoiceProvider.js';
import type { VoiceProvider } from './providers/VoiceProvider.js';

const piper = new PiperVoiceProvider();

const registry: Record<string, VoiceProvider> = {
  piper,
  pyttsx3: piper, // el servicio Python decide internamente Piper vs pyttsx3 segun disponibilidad.
  openai: new OpenAIVoiceProvider(),
  elevenlabs: new ElevenLabsVoiceProvider(),
  cartesia: new CartesiaVoiceProvider(),
  kokoro: new KokoroVoiceProvider(),
  xtts: new XTTSVoiceProvider(),
};

function getProvider(name: string): VoiceProvider | undefined {
  return registry[name];
}

const listedProviderNames = ['piper', 'openai', 'elevenlabs', 'cartesia', 'kokoro', 'xtts'];

export function listProviders() {
  return listedProviderNames.map(name => ({ name, configured: registry[name].configured }));
}

const cache = new AudioCache(env.VOICE_CACHE_TTL_HOURS * 60 * 60 * 1000, env.VOICE_CACHE_MAX_MB * 1024 * 1024);

export function clearAudioCache() {
  cache.clear();
}

export function audioCacheStats() {
  return { entries: cache.size, usedBytes: cache.usedBytes };
}

export type SpeakContext = {
  requestId: string;
  signal?: AbortSignal;
  sensitive?: boolean;
};

export type SpeakResult = {
  audio: Buffer;
  mimeType: string;
  provider: string;
  cacheHit: boolean;
  fallbackUsed: boolean;
};

/**
 * Sintetiza un segmento de texto usando el proveedor activo, con normalizacion de
 * pronunciacion, cache por hash y fallback a un segundo proveedor si el principal falla.
 * Este es el unico punto del backend que conoce que proveedores de voz existen: el
 * resto de Alfred solo llama a esta funcion.
 */
export async function synthesizeSpeech(text: string, context: SpeakContext = { requestId: 'manual' }): Promise<SpeakResult> {
  const settings = voiceSettingsStore.get();
  const normalized = normalizeForSpeech(text);
  if (!normalized) throw new TtsError('No hay texto para sintetizar.', false);

  const cacheEnabled = settings.cacheEnabled && !context.sensitive;
  const key = audioCacheKey({
    text: normalized,
    provider: settings.ttsProvider,
    voiceId: settings.ttsVoice,
    speed: settings.ttsSpeed,
    language: settings.ttsLanguage,
  });

  if (cacheEnabled) {
    const cached = cache.get(key);
    if (cached) {
      return { audio: cached.audio, mimeType: cached.mimeType, provider: settings.ttsProvider, cacheHit: true, fallbackUsed: false };
    }
  }

  async function trySynthesize(providerName: string): Promise<SpeakResult> {
    const provider = getProvider(providerName);
    if (!provider || !provider.configured) {
      throw new TtsError(`Proveedor de voz "${providerName}" no disponible o sin configurar.`, true);
    }
    const result = await provider.synthesize({
      text: normalized,
      voiceId: settings.ttsVoice,
      language: settings.ttsLanguage,
      speed: settings.ttsSpeed,
      signal: context.signal,
    });
    return { audio: result.audio, mimeType: result.mimeType, provider: providerName, cacheHit: false, fallbackUsed: false };
  }

  let result: SpeakResult;
  try {
    result = await trySynthesize(settings.ttsProvider);
  } catch (primaryError) {
    if (context.signal?.aborted) throw primaryError;
    eventBus.emit('tts.provider.failed', { requestId: context.requestId, provider: settings.ttsProvider, error: String(primaryError) });

    const fallbackName = settings.ttsFallbackProvider;
    if (!fallbackName || fallbackName === settings.ttsProvider) throw primaryError;

    try {
      result = { ...(await trySynthesize(fallbackName)), fallbackUsed: true };
    } catch (fallbackError) {
      eventBus.emit('tts.provider.failed', { requestId: context.requestId, provider: fallbackName, error: String(fallbackError) });
      throw fallbackError;
    }
  }

  if (cacheEnabled) cache.set(key, result.audio, result.mimeType);
  return result;
}

export async function cancelSpeech(requestId: string) {
  await cancelPiper(requestId);
  eventBus.emit('tts.cancelled', { requestId });
}

export async function voiceProviderHealth(name: string) {
  const provider = getProvider(name);
  if (!provider) return { ok: false, detail: 'unknown_provider' };
  if (!provider.configured) return { ok: false, detail: 'not_configured' };
  return provider.healthCheck();
}
