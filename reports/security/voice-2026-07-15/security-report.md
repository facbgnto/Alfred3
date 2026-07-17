# Voice Security Review

## Scope

Local voice gateway, STT/TTS provider calls, diagnostics, memory, tools and frontend voice controls.

## Confirmed Controls

- Frontend uses the Fastify backend gateway instead of directly depending on the internal STT port.
- Audio payloads are size-limited via `VOICE_MAX_AUDIO_BYTES`.
- Provider calls use timeouts.
- Tool execution is allow-listed and schema-validated with Zod.
- Diagnostics do not expose secrets.
- TTS input length is capped in the Python API.
- Memory is local and bounded.

## Findings

### Medium: No rate limiting on voice endpoints

- Location: `apps/api/src/routes/http.ts`
- Impact: A local or same-origin client can repeatedly send large audio requests and consume CPU.
- Confidence: High.
- Fix: Add Fastify rate limiting and per-session throttles before exposing beyond local development.

### Medium: No authentication boundary

- Location: API-wide.
- Impact: If bound to an untrusted network, local tools and voice processing could be triggered by unauthorized clients.
- Confidence: High.
- Fix: Keep local-only or add authentication/session checks.

### Low: pyttsx3 cancellation is best-effort

- Location: `apps/voice-service/app/tts.py`
- Impact: TTS may not stop instantly depending on OS audio driver.
- Confidence: Medium.
- Fix: Replace with Piper/Kokoro process or streaming provider with explicit cancellation.

## Residual Risk

The current implementation is appropriate for local development and controlled localhost usage. It is not yet hardened for LAN or internet exposure.
