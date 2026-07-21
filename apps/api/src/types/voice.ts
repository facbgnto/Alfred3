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

export type ProviderStatus = 'ok' | 'degraded' | 'unavailable';

export interface ProviderHealth {
  status: ProviderStatus;
  provider: string;
  latencyMs?: number;
  model?: string;
  url?: string;
  error?: string;
}

export interface VoiceMetrics {
  sttLatencyMs?: number;
  llmFirstTokenMs?: number;
  llmTotalMs?: number;
  ttsFirstAudioMs?: number;
  ttsTotalMs?: number;
  totalResponseMs?: number;
  ttsProvider?: string;
  sttProvider?: string;
  cacheHit?: boolean;
  interrupted?: boolean;
  fallbackUsed?: boolean;
  segments?: number;
}

export interface Transcript {
  text: string;
  provider: string;
  latencyMs: number;
}

export interface ChatRequest {
  requestId: string;
  sessionId?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  channel?: 'desktop' | 'voice';
  signal?: AbortSignal;
}

export interface ChatChunk {
  requestId: string;
  content: string;
  done: boolean;
  model: string;
}
