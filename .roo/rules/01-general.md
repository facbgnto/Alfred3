# Reglas generales — Roo Code

Fuente de verdad principal: [`AGENTS.md`](../../AGENTS.md) en la raíz del repo. Léelo
completo antes de tocar código. Estas reglas complementan, no reemplazan, ese archivo.

- Responde y documenta en español.
- Antes de implementar, lee README.md, package.json de cada workspace
  (`apps/api`, `apps/web`, `apps/voice-service`) y `config/` para entender
  stack y convenciones reales.
- No inventes archivos, endpoints, tablas, skills ni dependencias que no
  existan en el repo. Verifica con búsqueda antes de asumir.
- No dupliques lógica existente; busca implementaciones similares en
  `apps/api/src/skills` antes de crear una nueva.
- Cambios mínimos y localizados al requerimiento. Nada de refactors o
  limpiezas no solicitadas dentro de la misma tarea.
- No agregues dependencias nuevas sin justificar por qué la funcionalidad
  no existe ya en el stack (Fastify, React, Ollama, pgvector).
- No des una tarea por terminada si el proyecto no compila o `npm run doctor`
  falla.
