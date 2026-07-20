# Pruebas — Alfred 3.0

Estrategia completa (pendiente de definir cobertura): [`docs/TESTING.md`](../../docs/TESTING.md).

## Comandos reales del repo (verifica antes de asumir otros)

- `npm run doctor` — diagnóstico de stack completo, ejecútalo siempre al
  final de una tarea.
- `npm run build` — build de `apps/api` + `apps/web` (equivale a
  typecheck de ambos vía `tsc`).
- `npm test -w apps/api` — suite vitest de `apps/api`. **`apps/web` no
  tiene tests configurados todavía**; no inventes un comando `npm test`
  para web sin antes agregar la config real.
- No hay lint configurado en el repo (`eslint`/`biome` ausentes). No
  reportes "lint" como paso ejecutado si no existe; si agregas lint,
  hazlo como tarea explícita y documenta la decisión en un ADR.

## Antes de cerrar una tarea

1. `npm run build` sin errores.
2. `npm test -w apps/api` si tocaste algo en `apps/api`.
3. `npm run doctor` para confirmar el stack completo (Ollama, Postgres,
   voice-service) sigue sano.
4. Probar manualmente el flujo afectado (chat, voz, skill) cuando el
   cambio es de UI o WebSocket — no es cubierto por los tests actuales.
5. Si algo no se pudo ejecutar (ej. no hay Postgres corriendo), dilo
   explícito en el resumen final, no lo omitas.
