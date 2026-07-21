# Voice Security

## Boundaries

```text
Browser -> Fastify API -> Local providers
```

The browser does not call internal provider ports directly.

## Controls Implemented

- STT gateway validates audio presence and max size.
- Provider URLs come from validated configuration.
- Internal calls use timeouts and `AbortController` on every provider call.
- Tool execution is allow-listed through registered tools only.
- No arbitrary shell execution is exposed to the LLM.
- Diagnostics omit secrets.
- CORS is restricted to `WEB_ORIGIN`.
- TTS payload length is limited by the API (`/api/voice/synthesize` caps at
  2000 chars, `/api/voice/preview` at 1000) and by the Python service.
- Memory is local file storage under `data/memory`.
- **Cloud TTS providers (OpenAI, ElevenLabs, Cartesia) are disabled unless
  their API key/voice ID are explicitly set** — see
  [VOICE_PROVIDERS.md](./VOICE_PROVIDERS.md). Alfred stays local-first by
  default; enabling a cloud provider is an explicit, auditable opt-in via
  `.env`, never something the frontend can trigger on its own.
- API keys live only in backend `env` and are never included in any HTTP
  response — `GET /api/voice/settings` and `GET /api/voice/providers` only
  ever expose provider *names* and a `configured` boolean, never credentials.
- The audio cache (`VoiceManager`'s `AudioCache`) is per-process memory, not
  written to disk, and callers can mark a request `sensitive` to skip it
  entirely.
- Rate limiting (`@fastify/rate-limit`): 120 req/min per IP globally, 20
  req/min on routes that hit STT/TTS/LLM (`/api/voice/transcribe`,
  `/api/voice/process`, `/api/voice/preview`, `/api/voice/synthesize`,
  `/api/chat`), 30 req/min on `PUT /api/voice/settings`.

## Remaining Risks

- No user authentication is implemented; keep Alfred bound to trusted local networks.
- `/api/voice/synthesize`, `/api/voice/preview` and `PUT /api/voice/settings`
  have no auth — anyone on the trusted network/localhost can call them
  (rate-limited, but not authenticated).
- Local TTS provider is Piper with a `pyttsx3` fallback; quality depends on
  the installed Piper voice model.
- Browser microphone permissions depend on Chrome/Edge runtime settings.
- Barge-in relies on the browser's echo cancellation, not a server-side
  acoustic echo canceller; on hardware with weak AEC, Alfred's own voice can
  occasionally be misread as an interruption.
- Full security package reports should be generated before production deployment.
