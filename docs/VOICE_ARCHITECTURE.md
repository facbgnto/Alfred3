# Alfred Voice Architecture

## Current Phase

This document reflects the implemented local foundation across the requested phases.

```text
Browser
  -> Fastify API gateway
  -> Python voice service (STT + pyttsx3 TTS fallback)
  -> Ollama
  -> WebSocket events back to Browser
```

The browser must not call the Python STT service directly. Internal voice providers are reached through the Node API gateway.

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

## Known Gaps

- TTS is health-checked and cancellable, but current provider is still `pyttsx3`; Kokoro/Piper should replace it for production quality.
- Wake word is still transcript-based in `microphone_listener.py`, not OpenWakeWord.
- VAD exists in the Python listener via `webrtcvad`; browser manual recording is the UI fallback.
- Ollama streaming exists via `chatStream` and `/api/chat/stream`.
- Barge-in/cancellation is wired at the API/session/TTS level; full acoustic barge-in while speakers are playing still depends on the Python listener and audio device behavior.

## Cancellation

Every voice turn receives a `requestId`, `sessionId`, `AbortController`, state and metrics. Starting a new voice turn cancels the previous one. `POST /api/voice/cancel` cancels the active turn and asks TTS to stop.

## Memory

Short-term memory is stored locally in `data/memory/conversation.json`. The store keeps recent turns and compacts older turns into a bounded summary. Use `DELETE /api/memory` to clear it.

## Tools

Tools are allow-listed in `apps/api/src/services/tools/registry.ts`. The initial safe tool is `system.status`. No arbitrary shell command execution is exposed.
