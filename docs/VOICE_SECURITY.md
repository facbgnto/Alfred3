# Voice Security

## Boundaries

```text
Browser -> Fastify API -> Local providers
```

The browser does not call internal provider ports directly.

## Controls Implemented

- STT gateway validates audio presence and max size.
- Provider URLs come from validated configuration.
- Internal calls use timeouts.
- Tool execution is allow-listed through registered tools only.
- No arbitrary shell execution is exposed to the LLM.
- Diagnostics omit secrets.
- CORS is restricted to `WEB_ORIGIN`.
- TTS payload length is limited by the Python service.
- Memory is local file storage under `data/memory`.

## Remaining Risks

- No user authentication is implemented; keep Alfred bound to trusted local networks.
- TTS provider is pyttsx3 fallback, not a hardened production TTS service.
- Browser microphone permissions depend on Chrome/Edge runtime settings.
- Rate limiting is not yet implemented. Add it before exposing beyond localhost.
- Full security package reports should be generated before production deployment.
