---
name: facbgnto-security-review
description: Revisión defensiva de vulnerabilidades y superficie de ataque para aplicaciones web, APIs, autenticación, autorización, multi-tenant, archivos, pagos, dependencias y despliegues. Actívalo ante solicitudes sobre seguridad, ataques, permisos, datos sensibles o cambios significativos con impacto de seguridad.
license: MIT
metadata:
  author: FACBGNTO
  version: "1.0.0"
---

# FACBGNTO Security Review

## Cuándo activarlo

Activa este skill cuando la tarea afecte:

- autenticación, JWT, cookies, sesiones u OTP;
- autorización, roles, permisos, IDOR o multi-tenant;
- datos sensibles, médicos, personales o financieros;
- subida/descarga de archivos;
- endpoints públicos, webhooks, URLs externas o pagos;
- dependencias, despliegue o configuración;
- revisión de vulnerabilidades o posibles ataques.

En funcionalidades significativas realiza al menos una revisión focalizada aunque el usuario no mencione seguridad.

## Flujo

1. Lee `AGENTS.md`.
2. Registra la activación en `reports/agent-activity/`.
3. Identifica activos, entradas y límites de confianza.
4. Consulta Graphify para localizar la superficie afectada.
5. Revisa código y cambios Git.
6. Ejecuta herramientas disponibles.
7. Filtra falsos positivos.
8. Clasifica por severidad y confianza.
9. Genera informe.
10. Registra resultados y limitaciones.

## Revisiones mínimas

- Broken Access Control e IDOR.
- Aislamiento multi-tenant.
- Autenticación y gestión de sesión.
- SQL/NoSQL/command injection.
- XSS, CSRF y SSRF.
- Path traversal y archivos.
- Mass assignment.
- Secretos y logs.
- Rate limiting.
- Dependencias vulnerables.
- Integridad de montos y pagos.
- Webhooks y firmas.
- Auditoría.

## Reglas

- No inventes vulnerabilidades.
- Distingue hallazgos confirmados de riesgos potenciales.
- No ejecutes pruebas contra sistemas externos sin autorización.
- No afirmes que el sistema es seguro.
- No entregues instrucciones ofensivas destructivas.
- Cada hallazgo debe incluir evidencia, ubicación, impacto, confianza y corrección.

## Evidencia obligatoria

La respuesta final debe incluir:

```text
Skills utilizados:
- facbgnto-security-review

Herramientas ejecutadas:
- comando
- resultado
- código de salida

Limitaciones:
- cobertura no ejecutada
```

## Formato profesional obligatorio

Para revisiones significativas usa el paquete creado por:

```powershell
.\security-report.ps1 -ProjectPath "<proyecto>" -ReportName "<fecha-modulo>"
```

El paquete debe contener:

- `security-report.md`;
- `executive-summary.md`;
- `remediation-plan.md`;
- `risk-matrix.md`;
- `metrics.json`;
- `review-history.md`;
- `evidence/`.

El informe principal debe incluir:

- resumen ejecutivo;
- métricas de cobertura;
- arquitectura y superficie de ataque;
- matriz de riesgo;
- mapeo OWASP, ASVS y CWE;
- CVSS cuando corresponda;
- evidencia sanitizada;
- falsos positivos;
- controles correctos;
- DevSecOps y cadena de suministro;
- riesgo residual;
- plan de remediación;
- próximas auditorías;
- historial de revisiones.

No afirmes cumplimiento normativo completo a partir de una revisión parcial.
