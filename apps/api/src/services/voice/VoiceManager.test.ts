import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { synthesizeSpeech, clearAudioCache, listProviders } from './VoiceManager.js';
import { voiceSettingsStore } from './settingsStore.js';

function buildWav(bytes = 8): Buffer {
  const data = Buffer.alloc(bytes, 1);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe('VoiceManager.listProviders', () => {
  it('reports piper as always configured and cloud providers as not configured by default', () => {
    const providers = listProviders();
    const piper = providers.find(p => p.name === 'piper');
    const openai = providers.find(p => p.name === 'openai');
    expect(piper?.configured).toBe(true);
    expect(openai?.configured).toBe(false);
  });
});

describe('synthesizeSpeech', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    voiceSettingsStore.reset();
    clearAudioCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('synthesizes via the active local provider', async () => {
    const wav = buildWav();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audioBase64: wav.toString('base64') }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await synthesizeSpeech('Hola Felipe');
    expect(result.provider).toBe('piper');
    expect(result.cacheHit).toBe(false);
    expect(result.audio.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves repeated identical requests from cache without calling the provider again', async () => {
    const wav = buildWav();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audioBase64: wav.toString('base64') }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await synthesizeSpeech('Misma frase repetida');
    const second = await synthesizeSpeech('Misma frase repetida');

    expect(second.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the secondary provider when the primary is not configured', async () => {
    voiceSettingsStore.update({ ttsProvider: 'openai', ttsFallbackProvider: 'piper' });
    const wav = buildWav();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ audioBase64: wav.toString('base64') }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await synthesizeSpeech('Texto de respaldo');
    expect(result.provider).toBe('piper');
    expect(result.fallbackUsed).toBe(true);
  });

  it('throws when both primary and fallback providers are unconfigured', async () => {
    voiceSettingsStore.update({ ttsProvider: 'openai', ttsFallbackProvider: 'elevenlabs' });
    await expect(synthesizeSpeech('Sin proveedores disponibles')).rejects.toThrow();
  });
});
