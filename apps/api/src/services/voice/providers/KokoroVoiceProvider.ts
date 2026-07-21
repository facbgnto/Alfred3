import { env } from '../../../config/env.js';
import { TtsError } from '../errors.js';
import { timeoutSignal, type SynthesizeOptions, type SynthesizeResult, type VoiceProvider } from './VoiceProvider.js';

/**
 * Kokoro TTS local, servido via kokoro-fastapi (API compatible con OpenAI /v1/audio/speech).
 * Servicio local: no requiere API key, solo que el proceso este corriendo en KOKORO_BASE_URL.
 */
export class KokoroVoiceProvider implements VoiceProvider {
  name = 'kokoro';
  configured = true;

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const format = options.format ?? 'wav';
    const response = await fetch(`${env.KOKORO_BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        voice: options.voiceId ?? env.VOICE_TTS_VOICE,
        input: options.text,
        speed: options.speed ?? env.VOICE_TTS_SPEED,
        response_format: format,
      }),
      signal: timeoutSignal(30000, options.signal),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsError(`Kokoro respondio HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`, true);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return { audio, mimeType: format === 'wav' ? 'audio/wav' : `audio/${format}` };
  }

  async healthCheck() {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${env.KOKORO_BASE_URL}/health`, { signal: timeoutSignal(3000) });
      const latencyMs = Math.round(performance.now() - startedAt);
      return { ok: response.ok, detail: response.ok ? undefined : `HTTP ${response.status}`, latencyMs };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'no disponible' };
    }
  }
}
