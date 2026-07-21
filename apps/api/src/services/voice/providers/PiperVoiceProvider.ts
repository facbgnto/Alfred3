import { env } from '../../../config/env.js';
import { TtsError } from '../errors.js';
import { normalizeWav } from '../audio/wav.js';
import { timeoutSignal, type SynthesizeOptions, type SynthesizeResult, type VoiceProvider } from './VoiceProvider.js';

/**
 * Voz neuronal local (Piper ONNX) con respaldo pyttsx3, servida por el proceso
 * Python en apps/voice-service. El servicio decide internamente Piper vs pyttsx3
 * segun disponibilidad del modelo .onnx; aca solo se habla el contrato HTTP.
 */
export class PiperVoiceProvider implements VoiceProvider {
  name = 'piper';
  configured = true;

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const response = await fetch(`${env.VOICE_SERVICE_URL}/tts/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: options.text,
        voice: options.voiceId ?? env.VOICE_TTS_VOICE,
        speed: options.speed ?? env.VOICE_TTS_SPEED,
      }),
      signal: timeoutSignal(30000, options.signal),
    });

    if (!response.ok) {
      throw new TtsError(`TTS respondio HTTP ${response.status}.`, true);
    }

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    const raw = typeof payload.audioBase64 === 'string' ? Buffer.from(payload.audioBase64, 'base64') : undefined;
    const audio = raw ? normalizeWav(raw) : undefined;
    if (!audio) throw new TtsError('El motor de voz local no devolvio audio valido.', true);

    return { audio, mimeType: typeof payload.audioMimeType === 'string' ? payload.audioMimeType : 'audio/wav' };
  }

  async healthCheck() {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${env.VOICE_SERVICE_URL}/tts/health`, { signal: timeoutSignal(3000) });
      const latencyMs = Math.round(performance.now() - startedAt);
      if (!response.ok) return { ok: false, detail: `HTTP ${response.status}`, latencyMs };
      return { ok: true, latencyMs };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'no disponible' };
    }
  }
}

export async function cancelPiper(requestId: string) {
  await fetch(`${env.VOICE_SERVICE_URL}/tts/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId }),
    signal: timeoutSignal(3000),
  }).catch(() => undefined);
}
