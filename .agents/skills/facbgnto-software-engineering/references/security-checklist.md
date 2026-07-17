# Checklist de seguridad

## Autenticación y autorización

- ¿La autorización se valida en backend?
- ¿Los roles tienen el mínimo privilegio?
- ¿Se evita confiar en identificadores enviados por el cliente?
- ¿Los recursos se validan contra el propietario o tenant?

## Multi-tenant

- ¿Todas las consultas incluyen el tenant?
- ¿Las actualizaciones y eliminaciones incluyen el tenant?
- ¿Las relaciones evitan referencias cruzadas entre tenants?
- ¿Las cachés y archivos están aislados?

## Entradas y salidas

- ¿Las entradas tienen esquema y límites?
- ¿Se usan parámetros en consultas?
- ¿La salida escapa contenido no confiable?
- ¿Los mensajes no filtran detalles internos?

## Secretos

- ¿No hay tokens, claves ni contraseñas en el repositorio?
- ¿Los logs evitan secretos y datos personales?
- ¿La configuración sensible usa variables de entorno?

## Archivos y URLs

- ¿Se valida MIME, extensión, tamaño y nombre?
- ¿Los archivos se almacenan fuera del árbol ejecutable?
- ¿Se bloquea path traversal?
- ¿Las URLs evitan SSRF y esquemas inseguros?

## Operación

- ¿Existe rate limiting en acciones sensibles?
- ¿Las operaciones críticas son auditables?
- ¿Los errores tienen manejo seguro?
- ¿Las dependencias nuevas están justificadas?
