# Voice Setup Windows

## Install

```powershell
Copy-Item .env.example .env
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1
ollama pull qwen3:8b
ollama pull qwen3:4b
```

## Run

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-alfred.ps1
```

Open:

- UI: `http://localhost:5174`
- API: `http://localhost:34777`
- Voice: `http://127.0.0.1:8765`

## Stop

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-alfred.ps1
```

## Doctor

```powershell
npm run doctor
```

Install `ffmpeg` if doctor reports it missing. faster-whisper can read common audio formats through PyAV, but ffmpeg remains useful for troubleshooting and conversions.
