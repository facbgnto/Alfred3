# ALFRED 3.0

Asistente personal local inspirado en un centro de operaciones elegante: Ollama, voz continua, React, Fastify, PostgreSQL/pgvector y skills desacopladas.

## Requisitos
- Node.js 22+
- Python 3.11+
- Ollama instalado y ejecutándose
- PostgreSQL 16 con pgvector, o Docker Desktop
- Micrófono para el modo de voz

## Inicio rápido en Windows
```powershell
Copy-Item .env.example .env
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1
ollama pull qwen3:8b
ollama pull qwen3:4b
powershell -ExecutionPolicy Bypass -File scripts/start-windows.ps1
```
Abra `http://localhost:5174`.

Diagnostico del stack:
```bash
npm run doctor
```

## Base de datos
```bash
docker compose up -d postgres
```

## Desarrollo manual
Terminal 1:
```bash
npm run dev -w apps/api
```
Terminal 2:
```bash
npm run dev -w apps/web
```
Terminal 3:
```bash
apps/voice-service/.venv/Scripts/python apps/voice-service/run.py
```
Escucha continua local:
```bash
apps/voice-service/.venv/Scripts/python apps/voice-service/microphone_listener.py
```

## Arquitectura
- `apps/api`: núcleo, Ollama, WebSocket, estados y skills.
- `apps/web`: Command Center React.
- `apps/voice-service`: Whisper, VAD, micrófono y TTS.
- `infrastructure/postgres`: esquema de memoria, tareas, acciones y auditoría.
- `config`: personalidad, voz y permisos.

## Seguridad
Las skills peligrosas no se ejecutan directamente. El registro exige implementar confirmaciones persistentes antes de habilitar shell, instalaciones, push o acciones administrativas.

## Voz local
El frontend debe usar el backend como gateway de voz:

- `GET /api/voice/health`
- `GET /api/voice/diagnostics`
- `POST /api/voice/transcribe`

El servicio Python de STT queda interno en `http://127.0.0.1:8765`. Consulte `docs/VOICE_ARCHITECTURE.md` y `docs/VOICE_TROUBLESHOOTING.md`.

## Estado actual
Incluye una base funcional para chat local, eventos WebSocket, UI, transcripción, TTS, escucha continua por VAD y persistencia preparada. Las integraciones específicas (Moonraker, Home Assistant, calendario y VS Code) deben añadirse como plugins en `apps/api/src/skills`.
