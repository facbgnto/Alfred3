export type VoiceState =
  | 'offline'
  | 'idle'
  | 'waiting-wake-word'
  | 'wake_listening'
  | 'listening'
  | 'processing'
  | 'transcribing'
  | 'thinking'
  | 'executing'
  | 'speaking'
  | 'interrupted'
  | 'error';

export type ProviderHealth = {
  status: 'ok' | 'degraded' | 'unavailable';
  provider: string;
  latencyMs?: number;
  model?: string;
  url?: string;
  error?: string;
};

export type VoiceDiagnostics = {
  status: 'ok' | 'degraded';
  services: {
    stt: ProviderHealth;
    tts: ProviderHealth;
    ollama: ProviderHealth;
  };
  config: {
    sttProvider: string;
    ttsProvider: string;
    ttsFallbackProvider?: string;
    voiceMode?: string;
    cacheEnabled?: boolean;
    continuousConversation?: boolean;
    ollamaModel: string;
    ollamaVoiceModel: string;
    wakeWordEnabled: boolean;
    vadEnabled: boolean;
    bargeInEnabled: boolean;
  };
  cache?: { entries: number; usedBytes: number };
  metrics?: {
    sampleSize: number;
    interruptions: number;
    cacheHits: number;
    fallbacksUsed: number;
    avgSttLatencyMs?: number;
    avgLlmFirstTokenMs?: number;
    avgTtsFirstAudioMs?: number;
    avgTotalResponseMs?: number;
  };
};

export type VoiceMode =
  | 'normal'
  | 'conversation'
  | 'programming'
  | 'explanation'
  | 'navigation'
  | 'reminder'
  | 'alarm'
  | 'music'
  | 'error'
  | 'celebration';

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

export type VoiceProvidersResponse = {
  stt: { active: string; providers: Array<Record<string, unknown>>; fallbackEnabled: boolean };
  tts: { active: string; fallback: string; providers: Array<{ name: string; configured: boolean }> };
};

export type VoiceVoicesResponse = {
  active: { provider: string; voiceId: string };
  [provider: string]: unknown;
};
