import { env } from '../../config/env.js';
import type { ProviderHealth, Transcript } from '../../types/voice.js';
import { SttError } from './errors.js';

function defaultAudioName(mimeType?: string) {
  if (mimeType?.includes('webm')) return 'audio.webm';
  if (mimeType?.includes('mpeg')) return 'audio.mp3';
  if (mimeType?.includes('ogg')) return 'audio.ogg';
  return 'audio.wav';
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref();
  return controller.signal;
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\b(gracias por ver|suscribete|subtitulos realizados por.+)$/i, '')
    .trim();
}

export function getSttProviders() {
  return {
    active: env.VOICE_STT_PROVIDER,
    providers: [
      {
        name: env.VOICE_STT_PROVIDER,
        model: env.VOICE_STT_MODEL,
        language: env.VOICE_STT_LANGUAGE,
        device: env.VOICE_STT_DEVICE,
        computeType: env.VOICE_STT_COMPUTE_TYPE,
        baseUrl: env.VOICE_STT_BASE_URL,
      },
    ],
    fallbackEnabled: env.VOICE_STT_FALLBACK_ENABLED,
  };
}

export async function sttHealth(): Promise<ProviderHealth> {
  const startedAt = performance.now();
  try {
    const response = await fetch(`${env.VOICE_STT_BASE_URL}/health`, {
      signal: timeoutSignal(Math.min(env.VOICE_STT_TIMEOUT_MS, 3000)),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      return {
        status: 'unavailable',
        provider: env.VOICE_STT_PROVIDER,
        latencyMs,
        url: env.VOICE_STT_BASE_URL,
        error: `HTTP ${response.status}`,
      };
    }

    const payload = await response.json().catch(() => ({}));
    return {
      status: 'ok',
      provider: String(payload.provider ?? env.VOICE_STT_PROVIDER),
      model: String(payload.model ?? env.VOICE_STT_MODEL),
      latencyMs,
      url: env.VOICE_STT_BASE_URL,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      provider: env.VOICE_STT_PROVIDER,
      url: env.VOICE_STT_BASE_URL,
      error: error instanceof Error ? error.message : 'STT no disponible',
    };
  }
}

export async function transcribeAudio(
  audio: Buffer,
  options: { filename?: string; mimeType?: string } = {},
): Promise<Transcript> {
  if (audio.byteLength === 0) {
    throw new SttError('INVALID_AUDIO', 'El audio recibido esta vacio.', false);
  }

  if (audio.byteLength > env.VOICE_MAX_AUDIO_BYTES) {
    throw new SttError('AUDIO_TOO_LARGE', 'El audio excede el limite permitido.', false);
  }

  const startedAt = performance.now();
  const form = new FormData();
  const arrayBuffer = audio.buffer.slice(
    audio.byteOffset,
    audio.byteOffset + audio.byteLength,
  ) as ArrayBuffer;
  const file = new Blob([arrayBuffer], { type: options.mimeType ?? 'audio/wav' });
  form.append('file', file, options.filename ?? defaultAudioName(options.mimeType));

  let response: Response;
  try {
    response = await fetch(`${env.VOICE_STT_BASE_URL}/transcribe`, {
      method: 'POST',
      body: form,
      signal: timeoutSignal(env.VOICE_STT_TIMEOUT_MS),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new SttError(
      aborted ? 'STT_TIMEOUT' : 'STT_UNAVAILABLE',
      aborted
        ? 'El servicio de transcripcion excedio el tiempo limite.'
        : 'El servicio de transcripcion no esta disponible.',
      true,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new SttError(
      'STT_UNAVAILABLE',
      `STT respondio HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}.`,
      true,
    );
  }

  const payload = await response.json() as { text?: unknown };
  return {
    text: normalizeText(typeof payload.text === 'string' ? payload.text : ''),
    provider: env.VOICE_STT_PROVIDER,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}
