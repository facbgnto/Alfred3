# Voice Troubleshooting

## `ERR_CONNECTION_REFUSED` on port 8765

The frontend should not call `http://localhost:8765` directly. Use:

```text
POST /api/voice/transcribe
GET /api/voice/health
GET /api/voice/diagnostics
```

If diagnostics show STT unavailable:

1. Start the Python service:

   ```powershell
   apps/voice-service/.venv/Scripts/python apps/voice-service/run.py
   ```

2. Check health:

   ```powershell
   Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8765/health
   ```

3. Run:

   ```powershell
   npm run doctor
   ```

## IPv4/IPv6

Internal service URLs use `127.0.0.1` by default to avoid Windows `localhost` resolution differences.

## Ollama Unavailable

Start Ollama and ensure models exist:

```powershell
ollama serve
ollama pull qwen3:8b
ollama pull qwen3:4b
```

## Audio Upload Fails

Check:

- `VOICE_MAX_AUDIO_BYTES`;
- request `Content-Type`;
- whether the browser is sending raw audio to `/api/voice/transcribe`;
- Python dependencies in `apps/voice-service/.venv`.

## `429 Too Many Requests`

Rate limiting is enabled (`@fastify/rate-limit`): 20 req/min on
`/api/voice/transcribe`, `/api/voice/process`, `/api/voice/preview`,
`/api/voice/synthesize`, `/api/chat`; 30 req/min on `PUT /api/voice/settings`;
120 req/min globally on everything else. If continuous conversation mode is
retrying too aggressively after errors, that's usually the cause — check the
browser console for a tight retry loop rather than raising the limits.

## Barge-in doesn't trigger, or triggers on Alfred's own voice

- Doesn't trigger: check "Permitir interrumpir a Alfred" is on, and that
  `apps/web/public/vad/` exists (`npm install` runs
  `apps/web/scripts/copy-vad-assets.mjs` via `postinstall`; run it manually
  if it's missing after a fresh clone).
- False positives from Alfred's own voice: the browser's `echoCancellation`
  constraint should suppress most of it; if your hardware's AEC is weak,
  either accept the tradeoff or turn off "Permitir interrumpir a Alfred" for
  that session (`VOICE_BARGE_IN_ENABLED=false` disables it by default).

## Wake word never fires (openWakeWord)

Check the Python service logs on startup: it prints either "openWakeWord
activo con modelo '...'" or "openWakeWord no disponible (...)" with the
reason (missing dependency, failed model download, etc). See
[VOICE_PROVIDERS.md](./VOICE_PROVIDERS.md#wake-word) for the install steps.
If it falls back to the transcript-based path, wake word still works, just
with the older (slower, Whisper-based) detection.
