import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

// npm workspaces ejecutan este proceso con cwd=apps/api, donde no hay .env,
// asi que dotenv/config (basado en cwd) nunca encontraba el .env de la raiz
// del repo y todo corria silenciosamente con los defaults del schema de abajo.
const repoRootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env');
dotenv.config({ path: repoRootEnv });
dotenv.config();

const csv = z
  .string()
  .default('')
  .transform(value => value.split(',').map(item => item.trim()).filter(Boolean));

export const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(34777),
  WEB_ORIGIN: z.string().url().default('http://localhost:5174'),
  DATABASE_URL: z.string().default('postgresql://alfred:alfred@localhost:5432/alfred'),

  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_CHAT_MODEL: z.string().min(1).default('qwen3:8b'),
  OLLAMA_VOICE_MODEL: z.string().min(1).default('qwen3:4b'),
  OLLAMA_FALLBACK_MODEL: z.string().min(1).default('llama3.2:3b'),
  OLLAMA_STREAM: z.coerce.boolean().default(true),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  OLLAMA_KEEP_ALIVE: z.string().default('30m'),
  OLLAMA_NUM_CTX: z.coerce.number().int().positive().default(8192),

  VOICE_SERVICE_URL: z.string().url().default('http://127.0.0.1:8765'),
  VOICE_STT_BASE_URL: z.string().url().default('http://127.0.0.1:8765'),
  VOICE_STT_PROVIDER: z.enum(['faster-whisper', 'parakeet', 'whisper']).default('faster-whisper'),
  VOICE_STT_MODEL: z.string().min(1).default('small'),
  VOICE_STT_LANGUAGE: z.string().min(2).default('es'),
  VOICE_STT_DEVICE: z.string().min(1).default('auto'),
  VOICE_STT_COMPUTE_TYPE: z.string().min(1).default('int8'),
  VOICE_STT_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  VOICE_STT_AUTO_START: z.coerce.boolean().default(true),
  VOICE_STT_FALLBACK_ENABLED: z.coerce.boolean().default(true),
  VOICE_MAX_AUDIO_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),

  VOICE_WAKE_WORD_ENABLED: z.coerce.boolean().default(true),
  VOICE_WAKE_WORD: z.string().min(1).default('alfred'),
  VOICE_WAKE_WORD_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  VOICE_WAKE_WORD_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(2000),

  VOICE_VAD_ENABLED: z.coerce.boolean().default(true),
  VOICE_VAD_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  VOICE_VAD_MIN_SPEECH_MS: z.coerce.number().int().positive().default(250),
  VOICE_VAD_SILENCE_MS: z.coerce.number().int().positive().default(600),
  VOICE_VAD_MAX_RECORDING_MS: z.coerce.number().int().positive().default(30000),
  VOICE_VAD_PREBUFFER_MS: z.coerce.number().int().nonnegative().default(300),
  VOICE_VAD_POSTBUFFER_MS: z.coerce.number().int().nonnegative().default(200),

  VOICE_TTS_PROVIDER: z.enum(['kokoro', 'piper', 'pyttsx3']).default('pyttsx3'),
  VOICE_TTS_VOICE: z.string().min(1).default('es_female'),
  VOICE_TTS_LANGUAGE: z.string().min(2).default('es'),
  VOICE_TTS_SPEED: z.coerce.number().positive().default(1.0),
  VOICE_TTS_STREAM: z.coerce.boolean().default(true),
  VOICE_TTS_FALLBACK_PROVIDER: z.enum(['kokoro', 'piper', 'pyttsx3']).default('piper'),

  VOICE_BARGE_IN_ENABLED: z.coerce.boolean().default(true),
  VOICE_STOP_COMMANDS: csv.default('detente,silencio,cancela,para'),
  VOICE_NOISE_SUPPRESSION: z.coerce.boolean().default(true),
  VOICE_ECHO_CANCELLATION: z.coerce.boolean().default(true),
  VOICE_AUTO_GAIN_CONTROL: z.coerce.boolean().default(true),

  ALFRED_USER_NAME: z.string().default('Felipe'),
  ALFRED_ADDRESS: z.string().default('senor'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
