import { describe, expect, it, vi } from 'vitest';
import { AudioCache, audioCacheKey } from './audioCache.js';

describe('audioCacheKey', () => {
  it('produces the same hash for identical inputs', () => {
    const a = audioCacheKey({ text: 'Hola', provider: 'piper', voiceId: 'es_female', speed: 1 });
    const b = audioCacheKey({ text: 'Hola', provider: 'piper', voiceId: 'es_female', speed: 1 });
    expect(a).toBe(b);
  });

  it('is case/whitespace-insensitive on text', () => {
    const a = audioCacheKey({ text: 'Hola Mundo', provider: 'piper' });
    const b = audioCacheKey({ text: '  hola mundo  ', provider: 'piper' });
    expect(a).toBe(b);
  });

  it('differs when the provider changes', () => {
    const a = audioCacheKey({ text: 'Hola', provider: 'piper' });
    const b = audioCacheKey({ text: 'Hola', provider: 'openai' });
    expect(a).not.toBe(b);
  });

  it('differs when the voice changes', () => {
    const a = audioCacheKey({ text: 'Hola', provider: 'piper', voiceId: 'a' });
    const b = audioCacheKey({ text: 'Hola', provider: 'piper', voiceId: 'b' });
    expect(a).not.toBe(b);
  });
});

describe('AudioCache', () => {
  it('stores and retrieves audio by key', () => {
    const cache = new AudioCache(60_000, 1024 * 1024);
    const audio = Buffer.from('fake-audio');
    cache.set('key1', audio, 'audio/wav');
    const entry = cache.get('key1');
    expect(entry?.audio.toString()).toBe('fake-audio');
    expect(entry?.mimeType).toBe('audio/wav');
  });

  it('returns undefined for missing keys', () => {
    const cache = new AudioCache(60_000, 1024 * 1024);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('expires entries after the TTL', () => {
    vi.useFakeTimers();
    const cache = new AudioCache(1000, 1024 * 1024);
    cache.set('key1', Buffer.from('data'), 'audio/wav');
    vi.advanceTimersByTime(1500);
    expect(cache.get('key1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('evicts the oldest entries once the byte budget is exceeded', () => {
    const cache = new AudioCache(60_000, 10);
    cache.set('a', Buffer.alloc(6), 'audio/wav');
    cache.set('b', Buffer.alloc(6), 'audio/wav');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
  });

  it('clears all entries', () => {
    const cache = new AudioCache(60_000, 1024);
    cache.set('a', Buffer.alloc(4), 'audio/wav');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.usedBytes).toBe(0);
  });
});
