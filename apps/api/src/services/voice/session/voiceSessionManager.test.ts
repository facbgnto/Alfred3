import { describe, expect, it } from 'vitest';
import { voiceSessionManager } from './voiceSessionManager.js';

describe('voiceSessionManager', () => {
  it('cancels the previous request when a new one starts', () => {
    const first = voiceSessionManager.start('test');
    const second = voiceSessionManager.start('test');

    expect(first.abortController.signal.aborted).toBe(true);
    expect(voiceSessionManager.isActive(first.requestId)).toBe(false);
    expect(voiceSessionManager.isActive(second.requestId)).toBe(true);

    voiceSessionManager.cancel('test-cleanup');
  });
});
