import os from 'node:os';
import { env } from '../../config/env.js';
import { ollamaHealth } from '../ollama.js';
import { sttHealth } from './sttClient.js';
import { ttsHealth } from './tts/ttsClient.js';

type RecentError = {
  timestamp: string;
  service: string;
  event: string;
  error: string;
};

const recentErrors: RecentError[] = [];

export function recordVoiceError(service: string, event: string, error: unknown) {
  recentErrors.unshift({
    timestamp: new Date().toISOString(),
    service,
    event,
    error: error instanceof Error ? error.message : String(error),
  });

  recentErrors.splice(20);
}

export async function voiceDiagnostics() {
  const [stt, tts, ollama] = await Promise.all([sttHealth(), ttsHealth(), ollamaHealth()]);

  return {
    status: stt.status === 'ok' && ollama.status === 'ok' ? 'ok' : 'degraded',
    services: {
      stt,
      tts,
      ollama,
    },
    config: {
      sttProvider: env.VOICE_STT_PROVIDER,
      ttsProvider: env.VOICE_TTS_PROVIDER,
      ollamaModel: env.OLLAMA_CHAT_MODEL,
      ollamaVoiceModel: env.OLLAMA_VOICE_MODEL,
      wakeWordEnabled: env.VOICE_WAKE_WORD_ENABLED,
      vadEnabled: env.VOICE_VAD_ENABLED,
      bargeInEnabled: env.VOICE_BARGE_IN_ENABLED,
      ports: {
        api: env.API_PORT,
        sttBaseUrl: env.VOICE_STT_BASE_URL,
        ollamaBaseUrl: env.OLLAMA_BASE_URL,
      },
    },
    host: {
      platform: process.platform,
      arch: process.arch,
      memory: {
        freeBytes: os.freemem(),
        totalBytes: os.totalmem(),
      },
      cpus: os.cpus().length,
    },
    recentErrors,
  };
}
