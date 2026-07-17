---
name: graphify
description: Use the project's Graphify/code graph index when available to inspect dependencies, affected files, and architectural relationships before changing code. Activate for broad changes, impact analysis, refactors, API/backend/frontend flows, and security reviews.
---

# Graphify

Use this skill when a task benefits from repository graph context.

## Workflow

1. Check whether the project contains `.graphifyignore`, `graph.ps1`, `graph.sh`, `.codegraph`, or other Graphify artifacts.
2. If a graph index exists, use it to identify likely affected modules, dependencies, and call paths.
3. If graph scripts exist and the code changed materially, rebuild or validate the index with the local script:
   - Windows: `.\graph.ps1`
   - Unix-like shells: `./graph.sh`
4. Treat graph output as guidance only. Confirm conclusions by reading the source files.
5. If Graphify is not configured in the project, say so and continue with normal code search using `rg`.

## Rules

- Do not invent graph data, nodes, relationships, or architecture.
- Do not run external indexing services unless the user explicitly authorizes them.
- Prefer local project scripts and checked-in artifacts.
- For security-sensitive work, combine this with the security review skill and verify trust boundaries in source.
