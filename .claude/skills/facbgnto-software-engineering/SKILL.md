---
name: facbgnto-software-engineering
description: Flujo integral para analizar, especificar, planificar, implementar, probar, revisar y documentar cambios de software en proyectos existentes. Úsalo para nuevas funcionalidades, correcciones, refactorizaciones, migraciones, APIs, frontend, backend, bases de datos, seguridad y revisiones técnicas.
license: MIT
metadata:
  author: Felipe
  version: "1.0.0"
---

# FACBGNTO Software Engineering

Aplica un proceso de ingeniería disciplinado sin bloquear tareas simples.

## Principios obligatorios

1. Comprender antes de modificar.
2. No inventar arquitectura, rutas, tablas, variables ni contratos.
3. Mantener los cambios mínimos y coherentes con el proyecto.
4. Preservar compatibilidad salvo que el requerimiento indique lo contrario.
5. No afirmar que funciona sin evidencia verificable.
6. No exponer secretos ni incluir credenciales en código o documentación.
7. Para cambios importantes, crear especificación y plan antes de editar.
8. Usar pruebas y verificaciones acordes al riesgo.
9. Informar archivos modificados, decisiones y validaciones ejecutadas.
10. Nunca ocultar errores, pruebas fallidas o limitaciones.

## Selección del flujo

### Tarea pequeña

Se considera pequeña cuando:
- afecta uno o pocos archivos;
- la causa y solución son claras;
- no cambia contratos públicos ni esquema de datos;
- puede verificarse directamente.

Flujo:

1. Inspeccionar.
2. Implementar.
3. Ejecutar validación focalizada.
4. Revisar el diff.
5. Resumir.

### Tarea significativa

Se considera significativa cuando:
- agrega un módulo o flujo;
- cambia API, base de datos, permisos o seguridad;
- cruza frontend y backend;
- afecta múltiples dominios;
- implica migración o refactorización amplia.

Flujo:

1. Descubrimiento.
2. Especificación.
3. Análisis del repositorio.
4. Plan por tareas.
5. Implementación incremental.
6. Pruebas.
7. Revisión.
8. Documentación.
9. Resumen y evidencia.

## Descubrimiento

Antes de proponer cambios:

- Lee `AGENTS.md`, README y documentación relevante.
- Detecta stack, comandos, convenciones y estructura.
- Busca implementaciones similares.
- Identifica contratos, permisos, validaciones y efectos laterales.
- Si Graphify está disponible, verifica que exista `.graphifyignore` y que el índice esté actualizado.
- Para cambios significativos, consulta Graphify antes de definir los archivos afectados.
- Usa `graph.ps1` o `graph.sh` para reconstruir el índice cuando el código haya cambiado de forma relevante.
- Confirma siempre los hallazgos leyendo los archivos fuente.

Graphify no reemplaza la inspección del código.

## Especificación

Para tareas significativas crea o presenta:

- objetivo;
- alcance;
- fuera de alcance;
- actores y permisos;
- flujo funcional;
- reglas de negocio;
- datos y relaciones;
- contratos API;
- estados y errores;
- criterios de aceptación;
- riesgos;
- estrategia de pruebas.

Usa `templates/SPEC.md` cuando corresponda.

## Planificación

Divide el trabajo en tareas pequeñas y verificables.

Cada tarea debe incluir:

- resultado esperado;
- archivos o componentes probables;
- dependencia;
- validación;
- criterio de término.

No combines migración, backend, frontend y pruebas en una única tarea opaca.

Usa `templates/PLAN.md`.

## Implementación

- Sigue las convenciones existentes.
- Evita refactorizaciones no relacionadas.
- No dupliques lógica ya disponible.
- Valida entradas en el límite del sistema.
- Mantén separación de responsabilidades.
- Maneja errores explícitamente.
- Considera concurrencia, idempotencia y transacciones cuando corresponda.
- En sistemas multi-tenant, aplica siempre el alcance del tenant en lecturas y escrituras.
- En cambios de esquema, entrega migración reversible cuando sea viable.
- No edites migraciones ya aplicadas en producción.

## Frontend

- Mantén estados de carga, vacío, éxito y error.
- Evita llamadas duplicadas.
- Considera accesibilidad básica.
- No confíes en el frontend para seguridad o autorización.
- Mantén validación coherente con el backend.
- Reutiliza componentes y patrones existentes.

## Backend y API

- Conserva contratos existentes o documenta el cambio.
- Autoriza cada operación en el servidor.
- No mezcles autenticación con autorización.
- Limita datos por usuario, rol, tenant o club.
- Usa códigos HTTP y mensajes de error coherentes.
- Evita filtrar trazas, tokens o información sensible.
- Revisa transacciones y rollback en operaciones múltiples.

## Base de datos

- Revisa claves primarias, foráneas, índices y restricciones.
- Evita consultas N+1.
- Evalúa impacto de migraciones sobre datos existentes.
- Define valores por defecto y nulabilidad conscientemente.
- Incluye estrategia de rollback o recuperación.
- Para multi-tenant, indexa y filtra por identificador de tenant cuando corresponda.

## Pruebas y verificación

Elige pruebas según el riesgo:

- unitarias para lógica aislada;
- integración para API, repositorios y DB;
- componentes para UI;
- end-to-end para flujos críticos;
- build, lint y typecheck como verificación base.

Antes de finalizar:

1. Ejecuta las pruebas relevantes.
2. Ejecuta build/typecheck/lint disponibles.
3. Revisa el diff.
4. Busca secretos, logs temporales y código muerto.
5. Confirma criterios de aceptación.
6. Registra comandos y resultados.

Nunca digas “todo funciona” sin mostrar qué se comprobó.

## Depuración

No pruebes cambios al azar.

1. Reproduce.
2. Recopila evidencia.
3. Localiza la capa que falla.
4. Formula una hipótesis.
5. Diseña una comprobación mínima.
6. Corrige la causa, no solo el síntoma.
7. Agrega prueba de regresión.
8. Verifica flujos relacionados.

## Seguridad

Revisa especialmente:

- control de acceso;
- aislamiento multi-tenant;
- inyección;
- exposición de secretos;
- subida de archivos;
- validación de URL;
- CSRF/XSS;
- rate limiting;
- datos personales;
- logs;
- dependencias vulnerables.

Usa `references/security-checklist.md`.

## Integración con otros skills

Si están instalados:

- Usa Superpowers para brainstorming, planificación, TDD, depuración y revisión.
- Usa Agent Skills especializados para frontend, API, seguridad, documentación o Git.
- Usa UI/UX Pro Max para tareas de diseño, sistemas visuales, accesibilidad y revisión de interfaces.
- Usa LightRAG para consultar documentación, decisiones técnicas y reglas de negocio indexadas; confirma los resultados con las fuentes.
- Usa Everything Claude Code de manera selectiva. No cargues simultáneamente reglas equivalentes de Superpowers, ECC y este skill.
- Este skill actúa como coordinador y las reglas específicas del proyecto prevalecen.
- No ejecutes dos metodologías duplicadas; selecciona la más adecuada y conserva un único plan.


## Documentación y diagramas

Para tareas significativas:

- Mantén documentación como código dentro de `docs/`.
- Actualiza diagramas C4, componentes, secuencia, despliegue, flujo de datos y entidad-relación cuando sean afectados.
- Usa Mermaid para diagramas simples y versionables.
- Usa Structurizr cuando el proyecto requiera un modelo C4 formal.
- Usa SchemaSpy para documentación navegable de bases de datos cuando sea viable.
- Registra decisiones arquitectónicas mediante ADR.
- Ejecuta `diagrams.ps1 -CheckOnly` o `diagrams.sh` antes de finalizar.
- No generes diagramas inventados: deben reflejar archivos, infraestructura y contratos inspeccionados.

## Seguridad coordinada

Activa `facbgnto-security-review` cuando el cambio afecte autenticación, autorización, datos sensibles, archivos, pagos, endpoints públicos, dependencias o despliegue.

Registra los skills realmente utilizados en `reports/agent-activity/`.

## Salida final

Entrega:

- resumen del cambio;
- archivos modificados;
- decisiones técnicas;
- migraciones o configuración requerida;
- comandos de validación;
- resultados reales;
- pendientes o riesgos;
- instrucciones de despliegue cuando correspondan.
