# Arquitectura — Alfred 3.0

Referencia completa: [`docs/architecture/`](../../docs/architecture/) y
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## Componentes reales del repo

- `apps/api`: núcleo Fastify, integración Ollama, WebSocket, gestión de
  estados y skills. Aquí vive la lógica de negocio y orquestación.
- `apps/web`: Command Center en React. Solo UI y consumo de API/WebSocket.
- `apps/voice-service`: Python — Whisper, VAD, micrófono, TTS. Servicio
  interno en `http://127.0.0.1:8765`, **no** expuesto directo al frontend.
- `infrastructure/postgres`: esquema de memoria, tareas, acciones y auditoría
  (PostgreSQL + pgvector).
- `config`: personalidad, voz y permisos del asistente.

## Reglas de capas

- El frontend (`apps/web`) siempre pasa por el backend (`apps/api`) como
  gateway. Nunca llames `voice-service` directo desde el cliente — usa
  `/api/voice/*`.
- Skills nuevas van en `apps/api/src/skills`, aisladas y desacopladas del
  core.
- Acceso a datos encapsulado; no mezcles queries SQL sueltas en
  controladores/rutas.
- Antes de crear una función, revisa si ya existe algo reutilizable en
  `apps/api/src/skills` o servicios compartidos.
- Documenta decisiones arquitectónicas relevantes como ADR nuevo en
  [`docs/adr/`](../../docs/adr/) usando la plantilla `0001-template.md`, no
  como texto suelto en el PR.
