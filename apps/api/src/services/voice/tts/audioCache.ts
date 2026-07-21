import { createHash } from 'node:crypto';

export type AudioCacheKeyInput = {
  text: string;
  provider: string;
  voiceId?: string;
  speed?: number;
  language?: string;
  format?: string;
  instructions?: string;
};

export function audioCacheKey(input: AudioCacheKeyInput): string {
  const hash = createHash('sha256');
  hash.update(input.text.trim().toLowerCase());
  hash.update('|');
  hash.update(input.provider);
  hash.update('|');
  hash.update(input.voiceId ?? '');
  hash.update('|');
  hash.update(String(input.speed ?? ''));
  hash.update('|');
  hash.update(input.language ?? '');
  hash.update('|');
  hash.update(input.format ?? '');
  hash.update('|');
  hash.update(input.instructions ?? '');
  return hash.digest('hex');
}

type CacheEntry = {
  audio: Buffer;
  mimeType: string;
  expiresAt: number;
  bytes: number;
};

/**
 * Cache LRU en memoria de audio ya sintetizado, con TTL y tope de tamano total.
 * No cachear texto marcado como sensible (llamado ya filtra eso antes de invocar set()).
 */
export class AudioCache {
  private entries = new Map<string, CacheEntry>();
  private totalBytes = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly maxBytes: number,
  ) {}

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }
    // Mover al final para simular uso reciente (LRU).
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, audio: Buffer, mimeType: string): void {
    this.delete(key);
    const entry: CacheEntry = { audio, mimeType, expiresAt: Date.now() + this.ttlMs, bytes: audio.byteLength };
    this.entries.set(key, entry);
    this.totalBytes += entry.bytes;
    this.evictIfNeeded();
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.entries.delete(key);
  }

  private evictIfNeeded(): void {
    const oldestFirst = this.entries.keys();
    while (this.totalBytes > this.maxBytes) {
      const next = oldestFirst.next();
      if (next.done || !next.value) break;
      this.delete(next.value);
    }
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  get usedBytes(): number {
    return this.totalBytes;
  }
}
