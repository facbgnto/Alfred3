import { env } from '../../config/env.js';
import type { VoiceMode } from './config.js';

export type VoiceSettings = {
  enabled: boolean;
  ttsProvider: string;
  ttsFallbackProvider: string;
  ttsVoice: string;
  ttsSpeed: number;
  ttsLanguage: string;
  mode: VoiceMode;
  cacheEnabled: boolean;
  continuousConversation: boolean;
  bargeInEnabled: boolean;
  volume: number;
};

/**
 * Ajustes de voz mutables en caliente (sin reiniciar el proceso). Se inicializan desde
 * las variables de entorno y viven solo en memoria: un reinicio del API vuelve a los
 * valores de .env. Pensado para el panel de ajustes de voz del frontend.
 */
class VoiceSettingsStore {
  private settings: VoiceSettings = {
    enabled: true,
    ttsProvider: env.VOICE_TTS_PROVIDER,
    ttsFallbackProvider: env.VOICE_TTS_FALLBACK_PROVIDER,
    ttsVoice: env.VOICE_TTS_VOICE,
    ttsSpeed: env.VOICE_TTS_SPEED,
    ttsLanguage: env.VOICE_TTS_LANGUAGE,
    mode: env.VOICE_MODE,
    cacheEnabled: env.VOICE_CACHE,
    continuousConversation: false,
    bargeInEnabled: env.VOICE_BARGE_IN_ENABLED,
    volume: 1,
  };

  get(): VoiceSettings {
    return { ...this.settings };
  }

  update(partial: Partial<VoiceSettings>): VoiceSettings {
    this.settings = { ...this.settings, ...partial };
    return this.get();
  }

  reset(): VoiceSettings {
    this.settings = {
      enabled: true,
      ttsProvider: env.VOICE_TTS_PROVIDER,
      ttsFallbackProvider: env.VOICE_TTS_FALLBACK_PROVIDER,
      ttsVoice: env.VOICE_TTS_VOICE,
      ttsSpeed: env.VOICE_TTS_SPEED,
      ttsLanguage: env.VOICE_TTS_LANGUAGE,
      mode: env.VOICE_MODE,
      cacheEnabled: env.VOICE_CACHE,
      continuousConversation: false,
      bargeInEnabled: env.VOICE_BARGE_IN_ENABLED,
      volume: 1,
    };
    return this.get();
  }
}

export const voiceSettingsStore = new VoiceSettingsStore();
