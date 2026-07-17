import { describe, expect, it } from 'vitest';
import { splitIntoSpeakableSentences } from './sentenceSplitter.js';

describe('splitIntoSpeakableSentences', () => {
  it('splits text by sentence boundaries', () => {
    expect(splitIntoSpeakableSentences('Hola Felipe. Estoy escuchando. Listo para continuar.')).toEqual([
      'Hola Felipe.',
      'Estoy escuchando.',
      'Listo para continuar.',
    ]);
  });

  it('normalizes whitespace and returns a single chunk for short text', () => {
    expect(splitIntoSpeakableSentences('  Un   momento   ')).toEqual(['Un momento']);
  });
});
