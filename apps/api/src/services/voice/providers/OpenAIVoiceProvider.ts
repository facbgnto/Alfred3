import { env } from '../../../config/env.js';
import { TtsError } from '../errors.js';
import { ProviderNotConfiguredError, timeoutSignal, type SynthesizeOptions, type SynthesizeResult, type VoiceProvider } from './VoiceProvider.js';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

/**
 * OpenAI TTS (endpoint estable /v1/audio/speech). Deshabilitado por defecto:
 * requiere OPENAI_API_KEY, OPENAI_TTS_MODEL y OPENAI_TTS_VOICE explicitos en .env
 * porque el proyecto es local-first y no se asume ningun modelo/voz por defecto
 * (verificar el nombre de modelo vigente en la documentacion de OpenAI antes de activarlo).
 */
export class OpenAIVoiceProvider implements VoiceProvider {
  name = 'openai';

  get configured() {
    return Boolean(env.OPENAI_API_KEY && env.OPENAI_TTS_MODEL && env.OPENAI_TTS_VOICE);
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    if (!this.configured) throw new ProviderNotConfiguredError(this.name);

    const format = options.format ?? 'wav';
    const response = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL,
        voice: options.voiceId ?? env.OPENAI_TTS_VOICE,
        input: options.text,
        instructions: options.instructions,
        speed: options.speed,
        response_format: format,
      }),
      signal: timeoutSignal(30000, options.signal),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsError(`OpenAI TTS respondio HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`, response.status >= 500);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return { audio, mimeType: format === 'wav' ? 'audio/wav' : `audio/${format}` };
  }

  async healthCheck() {
    if (!this.configured) return { ok: false, detail: 'not_configured' };
    const startedAt = performance.now();
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
        signal: timeoutSignal(4000),
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      return { ok: response.ok, detail: response.ok ? undefined : `HTTP ${response.status}`, latencyMs };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'no disponible' };
    }
  }
}
