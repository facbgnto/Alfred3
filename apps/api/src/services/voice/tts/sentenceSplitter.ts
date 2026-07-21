const SENTENCE_END = /([.!?;:]+)(\s+|$)/g;
const COMPLETE_SENTENCE_BOUNDARY = /[.!?]+["')\]]?\s+/g;

/**
 * Extrae oraciones ya cerradas de un buffer que sigue creciendo (streaming de LLM).
 * Solo corta cuando hay signo de puntuacion seguido de espacio, para no partir
 * una oracion que todavia puede seguir creciendo. El resto queda en `rest`.
 */
export function extractCompleteSentences(buffer: string): { sentences: string[]; rest: string } {
  COMPLETE_SENTENCE_BOUNDARY.lastIndex = 0;
  const sentences: string[] = [];
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = COMPLETE_SENTENCE_BOUNDARY.exec(buffer)) !== null) {
    const end = match.index + match[0].length;
    const candidate = buffer.slice(start, end).trim();
    if (candidate) sentences.push(candidate);
    start = end;
  }

  return { sentences, rest: buffer.slice(start) };
}

/**
 * Si el buffer aun sin puntuacion de cierre ya supero maxChars (el LLM sigue
 * generando una oracion muy larga), corta en el ultimo espacio disponible para
 * no acumular texto indefinidamente antes de hablar. Evita cortes por debajo de
 * minChars para no producir audio entrecortado.
 */
export function forceFlushIfTooLong(buffer: string, maxChars: number, minChars: number): { segment?: string; rest: string } {
  if (buffer.length <= maxChars) return { rest: buffer };

  const cut = buffer.lastIndexOf(' ', maxChars);
  const splitAt = cut > minChars ? cut : maxChars;
  const segment = buffer.slice(0, splitAt).trim();
  const rest = buffer.slice(splitAt).trim();
  if (!segment) return { rest: buffer };
  return { segment, rest };
}

export function splitIntoSpeakableSentences(text: string, minLength = 32): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences: string[] = [];
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = SENTENCE_END.exec(normalized)) !== null) {
    const end = match.index + match[1].length;
    const candidate = normalized.slice(start, end).trim();
    sentences.push(candidate);
    start = match.index + match[0].length;
  }

  const tail = normalized.slice(start).trim();
  if (tail) {
    if (sentences.length > 0 && tail.length < minLength / 2) {
      sentences[sentences.length - 1] = `${sentences[sentences.length - 1]} ${tail}`;
    } else {
      sentences.push(tail);
    }
  }

  return sentences.length > 0 ? sentences : [normalized];
}
