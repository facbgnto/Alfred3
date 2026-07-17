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
