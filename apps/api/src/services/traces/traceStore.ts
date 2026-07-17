import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eventBus } from '../../core/eventBus.js';

export type TraceKind = 'assistant.turn' | 'tool.execution';

export type TraceEntry = {
  id: string;
  kind: TraceKind;
  timestamp: string;
  requestId: string;
  sessionId?: string;
  channel?: string;
  agentId?: string;
  model?: string;
  durationMs?: number;
  success: boolean;
  input?: unknown;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

type TraceStore = {
  entries: TraceEntry[];
};

const tracesPath = path.resolve(process.cwd(), '../../data/traces/assistant-traces.json');
const maxTraceEntries = 200;

async function readStore(): Promise<TraceStore> {
  try {
    const payload = await readFile(tracesPath, 'utf8');
    return JSON.parse(payload) as TraceStore;
  } catch {
    return { entries: [] };
  }
}

async function writeStore(store: TraceStore) {
  await mkdir(path.dirname(tracesPath), { recursive: true });
  await writeFile(tracesPath, JSON.stringify(store, null, 2), 'utf8');
}

export async function appendTrace(entry: Omit<TraceEntry, 'id' | 'timestamp'>) {
  const store = await readStore();
  const trace: TraceEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  store.entries.push(trace);
  if (store.entries.length > maxTraceEntries) {
    store.entries.splice(0, store.entries.length - maxTraceEntries);
  }

  await writeStore(store);
  eventBus.emit('trace.recorded', {
    id: trace.id,
    kind: trace.kind,
    requestId: trace.requestId,
    success: trace.success,
  });
  return trace;
}

export async function listTraces(limit = 50) {
  const store = await readStore();
  return store.entries.slice(-limit).reverse();
}

export async function clearTraces() {
  const empty = { entries: [] };
  await writeStore(empty);
  return empty;
}
