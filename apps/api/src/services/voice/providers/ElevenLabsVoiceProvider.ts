import { env } from '../../../config/env.js';
import { TtsError } from '../errors.js';
import { ProviderNotConfiguredError, timeoutSignal, type SynthesizeOptions, type SynthesizeResult, type VoiceProvider } from './VoiceProvider.js';

/**
 * ElevenLabs TTS. Deshabilitado por defecto: requiere ELEVENLABS_API_KEY y
 * ELEVENLABS_VOICE_ID. Ver https://elevenlabs.io/docs/api-reference/text-to-speech.
 */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  name = 'elevenlabs';

  get configured() {
    return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID);
  }

  async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    if (!this.configured) throw new ProviderNotConfiguredError(this.name);

    const voiceId = options.voiceId ?? env.ELEVENLABS_VOICE_ID;
    const outputFormat = options.format ?? env.ELEVENLABS_OUTPUT_FORMAT;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: options.text,
        model_id: env.ELEVENLABS_MODEL_ID,
        voice_settings: {
          stability: env.ELEVENLABS_STABILITY,
          similarity_boost: env.ELEVENLABS_SIMILARITY_BOOST,
          style: env.ELEVENLABS_STYLE,
          use_speaker_boost: env.ELEVENLABS_SPEAKER_BOOST,
        },
      }),
      signal: timeoutSignal(30000, options.signal),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsError(`ElevenLabs respondio HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}.`, response.status >= 500);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    const mimeType = outputFormat.startsWith('pcm') ? 'audio/pcm' : 'audio/mpeg';
    return { audio, mimeType };
  }

  async healthCheck() {
    if (!this.configured) return { ok: false, detail: 'not_configured' };
    const startedAt = performance.now();
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
        signal: timeoutSignal(4000),
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      return { ok: response.ok, detail: response.ok ? undefined : `HTTP ${response.status}`, latencyMs };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'no disponible' };
    }
  }
}
