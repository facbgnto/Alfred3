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
    ollamaModel: string;
    ollamaVoiceModel: string;
    wakeWordEnabled: boolean;
    vadEnabled: boolean;
    bargeInEnabled: boolean;
  };
};
