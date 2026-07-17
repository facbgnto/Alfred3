const SENTENCE_END = /([.!?;:]+)(\s+|$)/g;

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
