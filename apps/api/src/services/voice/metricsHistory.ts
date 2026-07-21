import { eventBus } from '../../core/eventBus.js';
import type { VoiceMetrics } from '../../types/voice.js';

type MetricsEntry = {
  requestId: string;
  sessionId: string;
  timestamp: string;
  metrics: VoiceMetrics;
  interrupted: boolean;
};

const MAX_ENTRIES = 50;
const history: MetricsEntry[] = [];

eventBus.subscribe(event => {
  if (event.type === 'voice.completed') {
    const payload = event.payload as { requestId: string; sessionId: string; metrics: VoiceMetrics };
    history.unshift({
      requestId: payload.requestId,
      sessionId: payload.sessionId,
      timestamp: event.timestamp,
      metrics: payload.metrics,
      interrupted: false,
    });
    history.splice(MAX_ENTRIES);
  } else if (event.type === 'voice.interrupted') {
    const payload = event.payload as { requestId: string; sessionId: string };
    history.unshift({
      requestId: payload.requestId,
      sessionId: payload.sessionId,
      timestamp: event.timestamp,
      metrics: {},
      interrupted: true,
    });
    history.splice(MAX_ENTRIES);
  }
});

export function getMetricsHistory(limit = 20) {
  return history.slice(0, limit);
}

export function metricsSummary() {
  const completed = history.filter(entry => !entry.interrupted && entry.metrics.totalResponseMs);
  const interruptedCount = history.filter(entry => entry.interrupted).length;
  const cacheHits = history.filter(entry => entry.metrics.cacheHit).length;
  const fallbacks = history.filter(entry => entry.metrics.fallbackUsed).length;
  const avg = (key: keyof VoiceMetrics) => {
    const values = completed.map(entry => entry.metrics[key]).filter((v): v is number => typeof v === 'number');
    if (!values.length) return undefined;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  return {
    sampleSize: history.length,
    interruptions: interruptedCount,
    cacheHits,
    fallbacksUsed: fallbacks,
    avgSttLatencyMs: avg('sttLatencyMs'),
    avgLlmFirstTokenMs: avg('llmFirstTokenMs'),
    avgTtsFirstAudioMs: avg('ttsFirstAudioMs'),
    avgTotalResponseMs: avg('totalResponseMs'),
  };
}
