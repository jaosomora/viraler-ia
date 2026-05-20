---
name: branch-por-trabajo
description: "Al iniciar cualquier trabajo nuevo, crear una rama aparte que parta de la última versión de main (producción). Reportar la ruta del worktree apenas se cree."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c5683308-64dc-43ae-97e4-5099ba298314
---

Al iniciar cualquier trabajo nuevo, crear una rama aparte que parte de la última versión de `main` (producción), no de la rama actual ni del HEAD local. Reportar la ruta absoluta del worktree apenas se cree, para que Julian pueda editar `.env`, levantar el dev server o hacer cambios manuales sin tener que preguntar.

**Why:** Julian trabaja desde múltiples máquinas y cambia de contexto seguido. Empezar siempre desde `main` (no desde `develop` ni desde restos de trabajo previo) garantiza un punto de partida limpio y predecible. Y tener la ruta del worktree a la vista evita preguntar "¿dónde está cargado todo?" al setear cosas como `JAMENDO_CLIENT_ID` en `.env`.

**How to apply:**
- Al recibir un pedido de trabajo nuevo (no continuación del actual), antes de tocar código:
  1. `git fetch origin main` para asegurar que tengo la versión actualizada de producción
  2. Crear worktree o rama nueva desde `origin/main` con nombre descriptivo del trabajo
  3. Imprimir al usuario: la ruta absoluta del worktree (`/Users/jaom71/Documents/as-transcribe/.claude/worktrees/<nombre>`) y el nombre de la rama
  4. Recordarle que el worktree necesita su propio `.env` (ver feedback [[worktree-env]])
- Si la conversación es claramente continuación de un trabajo en curso (estamos a mitad de implementación, debug, etc.), no crear rama nueva — seguir en la actual.
- En duda, preguntar antes de crearla.
