import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type MemoryEntry = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

type MemoryStore = {
  recent: MemoryEntry[];
  summary: string;
};

const memoryPath = path.resolve(process.cwd(), '../../data/memory/conversation.json');
const maxRecentEntries = 16;

async function readStore(): Promise<MemoryStore> {
  try {
    const payload = await readFile(memoryPath, 'utf8');
    return JSON.parse(payload) as MemoryStore;
  } catch {
    return { recent: [], summary: '' };
  }
}

async function writeStore(store: MemoryStore) {
  await mkdir(path.dirname(memoryPath), { recursive: true });
  await writeFile(memoryPath, JSON.stringify(store, null, 2), 'utf8');
}

function summarize(entries: MemoryEntry[], previous = '') {
  const compact = entries
    .slice(-8)
    .map(entry => `${entry.role}: ${entry.content.slice(0, 180)}`)
    .join(' | ');
  return [previous, compact].filter(Boolean).join('\n').slice(-3000);
}

export async function appendConversation(role: MemoryEntry['role'], content: string) {
  const store = await readStore();
  store.recent.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  if (store.recent.length > maxRecentEntries) {
    const overflow = store.recent.splice(0, store.recent.length - maxRecentEntries);
    store.summary = summarize(overflow, store.summary);
  }

  await writeStore(store);
}

export async function getConversationContext() {
  const store = await readStore();
  return store;
}

export async function clearConversationMemory() {
  const empty = { recent: [], summary: '' };
  await writeStore(empty);
  return empty;
}
