import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('loads voice defaults', () => {
    const env = parseEnv({});

    expect(env.API_PORT).toBe(34777);
    expect(env.VOICE_STT_PROVIDER).toBe('faster-whisper');
    expect(env.VOICE_STT_BASE_URL).toBe('http://127.0.0.1:8765');
    expect(env.VOICE_STOP_COMMANDS).toContain('detente');
  });

  it('rejects invalid provider values', () => {
    expect(() => parseEnv({ VOICE_STT_PROVIDER: 'cloud' })).toThrow();
  });
});
