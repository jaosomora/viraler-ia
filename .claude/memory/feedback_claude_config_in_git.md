---
name: Configuración de Claude en git
description: Todos los archivos de Claude Code deben estar versionados en el repo para portabilidad
type: feedback
---

Mantener CLAUDE.md, .claude/settings.json, y memorias sincronizadas en git. Julian quiere que trabajar en este proyecto sea idempotente sin importar desde qué máquina trabaje.

**Why:** Julian cambia de computador frecuentemente y quiere que Claude tenga el mismo contexto siempre.
**How to apply:** Los archivos de configuración de Claude (.claude/settings.json, CLAUDE.md) ya están en el repo. Las memorias se sincronizan via hook post-commit.
