import { env } from '../../../config/env.js';
import { TtsError } from '../errors.js';
import { ProviderNotConfiguredError, timeoutSignal, type SynthesizeOptions, type SynthesizeResult, type VoiceProvider } from './VoiceProvider.js';

const CARTESIA_VERSION = '2024-11-13';

/**
 * Cartesia Sonic TTS (REST /tts/bytes). EXPERIMENTAL: el contrato exacto de la API
 * puede variar entre versiones; verificar contra la documentacion vigente de Cartesia
 * (https://docs.cartesia.ai) antes de depender de este proveedor en produccion.
 * Deshabilitado por defecto: requiere CARTESIA_API_KEY y CARTESIA_VOICE_ID.
 */
export class CartesiaVoiceProvider implements VoiceProvider {
  name = 'cartesia';

  get configured() {
    return Boolean(env.CARTESIA_API_KEY && env.CARTESIA_VOICE_ID);
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    if (!this.configured) throw new ProviderNotConfiguredError(this.name);

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-API-Key': env.CARTESIA_API_KEY,
        'Cartesia-Version': CARTESIA_VERSION,
      },
      body: JSON.stringify({
        model_id: env.CARTESIA_MODEL_ID,
        transcript: options.text,
        voice: { mode: 'id', id: options.voiceId ?? env.CARTESIA_VOICE_ID },
        language: options.language ?? env.VOICE_TTS_LANGUAGE,
        output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 22050 },
      }),
      signal: timeoutSignal(30000, options.signal),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsError(`Cartesia respondio HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`, response.status >= 500);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return { audio, mimeType: 'audio/wav' };
  }

  async healthCheck() {
    if (!this.configured) return { ok: false, detail: 'not_configured' };
    return { ok: false, detail: 'health_check_not_verified' };
  }
}
