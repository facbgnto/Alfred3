# Prompt para modo agente en Roo Code

Pega esto en el chat de Roo Code (modo Code/Agent) para trabajar de forma
autónoma sobre este repo, similar a Codex:

```
Analiza completamente este repositorio antes de realizar cambios.

Trabaja como un agente de desarrollo autónomo similar a Codex.

Debes:

1. Leer AGENTS.md y todas las reglas en .roo/rules/.
2. Confirmar el stack real leyendo package.json (raíz, apps/api, apps/web)
   y README.md — no asumas comandos ni dependencias que no estén ahí.
3. Buscar todos los archivos relacionados con el requerimiento en
   apps/api, apps/web, apps/voice-service, infrastructure/postgres y config.
4. Revisar impacto en frontend, backend, base de datos, seguridad y
   pruebas existentes.
5. Crear un plan de implementación breve antes de tocar código.
6. Implementar los cambios directamente en los archivos.
7. Mantener compatibilidad con el código y arquitectura existentes.
8. No inventar rutas, modelos, tablas, skills ni dependencias.
9. Ejecutar `npm run build`, `npm test -w apps/api` si aplica, y
   `npm run doctor`.
10. Corregir los errores provocados por la implementación.
11. No modificar archivos fuera del alcance sin justificación técnica.
12. Entregar al finalizar:
    - resumen;
    - archivos creados;
    - archivos modificados;
    - migraciones de base de datos si las hay;
    - comandos ejecutados y su resultado real;
    - pruebas realizadas y las que no se pudieron ejecutar;
    - riesgos o tareas pendientes.

No te limites a entregar fragmentos de código. Implementa la solución
completa en el repositorio y verifica que funcione.
```

## Nota sobre modelo

- Tareas simples (edición puntual, explicación): modelo 7B local va bien.
- Cambios que tocan varios archivos/capas (API + web + DB): usa un modelo
  14B+ o `qwen3-coder` si está disponible; con 7B el plan tiende a quedar
  incompleto en repos con esta cantidad de módulos.
