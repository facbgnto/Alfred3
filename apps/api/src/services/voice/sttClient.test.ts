import { describe, expect, it } from 'vitest';
import { VoiceError } from './errors.js';
import { transcribeAudio } from './sttClient.js';

describe('transcribeAudio', () => {
  it('rejects empty audio before calling STT', async () => {
    await expect(transcribeAudio(Buffer.alloc(0))).rejects.toMatchObject({
      code: 'INVALID_AUDIO',
      retryable: false,
    } satisfies Partial<VoiceError>);
  });
});
