export type SynthesizeOptions = {
  text: string;
  voiceId?: string;
  language?: string;
  speed?: number;
  format?: string;
  instructions?: string;
  emotion?: string;
  signal?: AbortSignal;
};

export type SynthesizeResult = {
  audio: Buffer;
  mimeType: string;
};

export interface VoiceProvider {
  name: string;
  configured: boolean;

  synthesize(options: SynthesizeOptions): Promise<SynthesizeResult>;

  stream?(options: SynthesizeOptions): AsyncIterable<Uint8Array>;

  healthCheck(): Promise<{ ok: boolean; detail?: string; latencyMs?: number }>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`El proveedor de voz "${provider}" no tiene credenciales o URL configuradas.`);
    this.name = 'ProviderNotConfiguredError';
  }
}

export function timeoutSignal(timeoutMs: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
