# Alfred Voice Architecture

## Current Phase

This document reflects the implemented local foundation, now with a provider
abstraction layer, real barge-in, audio caching, and per-mode voice settings.

```text
Browser (continuous mic capture + barge-in VAD)
  -> Fastify API gateway
  -> VoiceManager (normalize -> cache -> provider -> fallback)
       -> Python voice service (Piper / pyttsx3, local)
       -> cloud providers (OpenAI/ElevenLabs/Cartesia/Kokoro/XTTS), disabled by default
  -> Ollama
  -> WebSocket events back to Browser
```

The browser must not call the Python STT service directly, nor any cloud TTS
provider directly. Every voice provider is reached through `VoiceManager`
(`apps/api/src/services/voice/VoiceManager.ts`) via the Node API gateway; the
rest of Alfred never imports a provider SDK directly. See
[VOICE_PROVIDERS.md](./VOICE_PROVIDERS.md) for the provider abstraction,
[VOICE_SECURITY.md](./VOICE_SECURITY.md) for why cloud providers stay
disabled unless explicitly configured.

## Services

- Web: React/Vite on `http://localhost:5174`.
- API: Fastify on `http://localhost:34777`.
- Voice service: FastAPI on `http://127.0.0.1:8765`.
- Ollama: `http://127.0.0.1:11434`.

## Implemented Endpoints

- `GET /health`
- `GET /api/voice/health`
- `GET /api/voice/health/stt`
- `GET /api/voice/health/tts`
- `GET /api/voice/health/ollama`
- `GET /api/voice/providers`
- `GET /api/voice/diagnostics`
- `POST /api/voice/transcribe`
- `POST /api/voice/process`
- `POST /api/voice/cancel`
- `POST /api/voice/transcript`
- `POST /api/voice/state`
- `GET /api/voice/settings`
- `PUT /api/voice/settings`
- `GET /api/voice/voices`
- `POST /api/voice/preview`
- `POST /api/voice/synthesize`
- `GET /api/voice/metrics`
- `POST /api/chat/stream`
- `GET /api/tools`
- `POST /api/tools/:name`
- `GET /api/memory`
- `DELETE /api/memory`

## STT Gateway

`POST /api/voice/transcribe` accepts:

- raw audio bodies with `audio/*` or `application/octet-stream`;
- JSON payloads with `audioBase64`, `filename`, and `mimeType`.

The API applies:

- max audio size via `VOICE_MAX_AUDIO_BYTES`;
- STT timeout via `VOICE_STT_TIMEOUT_MS`;
- typed error responses;
- provider health checks.

## Barge-in (full-duplex)

When continuous listening is on (`useVoiceRecorder` with `continuous: true`),
the browser keeps the microphone open across turns instead of closing it
between utterances. While Alfred is in the `speaking` state, the recorder
raises its speech-detection threshold (`speechThreshold * 2.2`, see
`bargeInThresholdMultiplier` in `apps/web/src/features/voice/hooks/useVoiceRecorder.ts`)
to avoid false positives from Alfred's own voice leaking through the
speakers despite `echoCancellation: true`. Once that elevated threshold is
crossed:

1. The client discards any audio buffered so far (it was Alfred's own
   playback, not the user) and starts capturing the new utterance.
2. `stopPlayback()` (from `useAlfredSocket`) stops the local `<audio>`
   element immediately and clears the queued segments — this is the
   lowest-latency part of the interruption.
3. `POST /api/voice/cancel` cancels the active session
   (`voiceSessionManager.cancel`), which aborts the in-flight LLM stream via
   `AbortController`, asks the TTS provider to cancel, and emits
   `voice.interrupted` over the WebSocket as a confirmation for any other
   connected client.
4. The recorder keeps capturing the user's new utterance and, on silence,
   sends it through the normal `/api/voice/process` flow.

Known limitation: acoustic leakage during barge-in detection is bounded by
the browser's AEC, not by a server-side echo canceller — on hardware with
poor AEC, false positives are possible. `VOICE_BARGE_IN_ENABLED` and the
frontend toggle ("Permitir interrumpir a Alfred") let it be turned off per
session.

## Known Gaps

- TTS provider abstraction (`VoiceManager`) is real for Piper/pyttsx3
  (local); OpenAI/ElevenLabs/Cartesia/Kokoro/XTTS providers are implemented
  against their documented REST contracts but stay disabled until
  credentials/URLs are set — see [VOICE_PROVIDERS.md](./VOICE_PROVIDERS.md).
- Wake word uses openWakeWord (acoustic, no transcription) when its optional
  dependency is installed; otherwise it falls back to the previous
  transcript-based check. See [VOICE_PROVIDERS.md](./VOICE_PROVIDERS.md).
  No official model exists for the word "alfred" — defaults to `hey_jarvis`
  until a custom model is trained.
- VAD is real Silero VAD in the browser (`@ricky0123/vad-web`, elevated
  threshold during barge-in) and `webrtcvad` in the Python listener.
- Ollama streaming exists via `chatStream` and `/api/chat/stream`.
- Rate limiting is implemented (`@fastify/rate-limit`): 120 req/min global,
  20 req/min on STT/TTS/LLM-heavy routes (`/api/voice/transcribe`,
  `/api/voice/process`, `/api/voice/preview`, `/api/voice/synthesize`,
  `/api/chat`), 30 req/min on `PUT /api/voice/settings`. No per-user auth yet
  — see [VOICE_SECURITY.md](./VOICE_SECURITY.md).

## Cancellation

Every voice turn receives a `requestId`, `sessionId`, `AbortController`, state and metrics. Starting a new voice turn cancels the previous one. `POST /api/voice/cancel` cancels the active turn and asks TTS to stop.

## Audio cache

`VoiceManager` caches synthesized audio in memory, keyed by a SHA-256 hash of
the normalized text, provider, voice, speed and language
(`apps/api/src/services/voice/tts/audioCache.ts`). Entries expire after
`VOICE_CACHE_TTL_HOURS` and the cache evicts the oldest entries once
`VOICE_CACHE_MAX_MB` is exceeded. Disable with `VOICE_CACHE=false` or the
frontend "Cache de audio" toggle; `PUT /api/voice/settings` with
`cacheEnabled: false` also clears the cache immediately.

## Pronunciation normalization

Before any text reaches a TTS provider, `normalizeForSpeech`
(`apps/api/src/services/voice/tts/textNormalizer.ts`) rewrites IP addresses,
emails, URLs, Windows/Linux paths, Chilean RUTs, percentages, currency,
phone numbers, hours, dates and common technical acronyms into a form that
reads naturally out loud, and summarizes large code/JSON blocks instead of
reading them verbatim.

## Memory

Short-term memory is stored locally in `data/memory/conversation.json`. The store keeps recent turns and compacts older turns into a bounded summary. Use `DELETE /api/memory` to clear it.

## Tools

Tools are allow-listed in `apps/api/src/services/tools/registry.ts`. The initial safe tool is `system.status`. No arbitrary shell command execution is exposed.
