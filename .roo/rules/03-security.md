# Seguridad — Alfred 3.0

Checklist completo: [`docs/SECURITY.md`](../../docs/SECURITY.md) y
[`SECURITY.md`](../../SECURITY.md) en la raíz. Activa el skill
`facbgnto-security-review` (o `security-storage` si toca storage/tokens/PII)
antes de entregar cambios en auth, skills, archivos, red o dependencias.

- Skills marcadas como peligrosas (shell, instalaciones, push, acciones
  administrativas) **no** se ejecutan sin confirmación persistente explícita
  del usuario. No elimines ni debilites esa capa de confirmación para "hacer
  pasar" una tarea.
- El frontend nunca llama `voice-service` (127.0.0.1:8765) directo; todo
  pasa por el gateway `apps/api` (`/api/voice/*`). No abras ese puerto al
  exterior.
- Nunca subas, loguees ni imprimas contenido de `.env`, claves de API,
  tokens ni credenciales de Postgres. Usa `.env.example` como referencia de
  variables, sin valores reales.
- Ollama corre local — no reemplaces llamadas locales por endpoints externos
  ni envíes transcripciones de voz o memoria del usuario a servicios de
  terceros sin que el usuario lo pida explícitamente.
- Valida toda entrada que llegue por HTTP/WebSocket antes de tocar
  Postgres o disparar una skill.
- Usa consultas parametrizadas / el ORM existente; no concatenes SQL.
- Transacciones para operaciones multi-paso sobre memoria/tareas/acciones
  (auditoría no debe quedar en estado parcial).
- Si el repo evoluciona a multi-usuario o multi-tenant en el futuro, define
  primero el campo de aislamiento (tenant/usuario) en un ADR — no lo
  inventes ni lo asumas ahora; hoy el sistema es single-user local.
