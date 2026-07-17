# Migración desde ALFRED 2.x

No copie `node_modules`, `.venv`, `dist`, logs ni `.env`.

Migrar de forma selectiva:
- normalización y sanitización de voz;
- clientes Moonraker y Home Assistant;
- gestores de tareas y VS Code;
- prompts útiles y comandos deterministas.

Reescribir:
- `useVoiceWake.ts`;
- permisos duplicados;
- confirmaciones en RAM;
- ejecución shell libre;
- memoria Markdown como fuente principal.
