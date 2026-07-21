import { env } from '../../../config/env.js';
import { TtsError } from '../errors.js';
import { ProviderNotConfiguredError, timeoutSignal, type SynthesizeOptions, type SynthesizeResult, type VoiceProvider } from './VoiceProvider.js';

/**
 * XTTS v2 local, servido por nuestro propio servidor FastAPI
 * (apps/voice-service/xtts_server/main.py, no el paquete xtts-api-server de PyPI —
 * ver requirements-xtts.txt para por que). Contrato HTTP (/tts_to_audio/,
 * /speakers_list) verificado extremo a extremo contra ese servidor.
 * Solo permite hablar con una muestra de voz autorizada localmente (XTTS_SPEAKER_ID,
 * resuelta server-side dentro de xtts-samples/, sin path traversal); no se acepta
 * clonacion de voces de terceros sin autorizacion. Lento en CPU (~15s/oracion en
 * hardware sin GPU) — pensado como proveedor opcional, no default para conversacion
 * en vivo.
 */
export class XTTSVoiceProvider implements VoiceProvider {
  name = 'xtts';

  get configured() {
    return Boolean(env.XTTS_SPEAKER_ID);
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    if (!this.configured) throw new ProviderNotConfiguredError(this.name);

    const response = await fetch(`${env.XTTS_BASE_URL}/tts_to_audio/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: options.text,
        speaker_wav: options.voiceId ?? env.XTTS_SPEAKER_ID,
        language: options.language ?? env.VOICE_TTS_LANGUAGE,
      }),
      signal: timeoutSignal(45000, options.signal),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsError(`XTTS respondio HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`, true);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return { audio, mimeType: 'audio/wav' };
  }

  async healthCheck() {
    if (!this.configured) return { ok: false, detail: 'not_configured' };
    const startedAt = performance.now();
    try {
      const response = await fetch(`${env.XTTS_BASE_URL}/speakers_list`, { signal: timeoutSignal(3000) });
      const latencyMs = Math.round(performance.now() - startedAt);
      return { ok: response.ok, detail: response.ok ? undefined : `HTTP ${response.status}`, latencyMs };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'no disponible' };
    }
  }
}
