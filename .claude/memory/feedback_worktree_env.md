---
name: Worktrees - copiar .env del repo principal
description: Al crear o usar un git worktree de as-transcribe, el .env no se hereda y hay que copiarlo manualmente antes de levantar dev.
type: feedback
originSessionId: 1eddb9c2-3e30-49d9-be2b-c9cc025c6ae7
---
Cuando trabajes en un worktree de `as-transcribe` (cualquier path bajo `.claude/worktrees/`), ANTES de sugerir `npm run dev` o cualquier flujo que use API keys, copia el `.env` del repo principal:

```bash
cp /Users/jaom71/Documents/as-transcribe/.env <worktree_path>/.env
```

**Why:** El `.env` está gitignored, así que un worktree recién creado arranca sin envs. El servidor levanta pero falla al primer llamado a OpenAI/Anthropic/Resend con `OPENAI_API_KEY no configurada` u otro mensaje similar. Pasó el 2026-05-06 y costó un ciclo de prueba completo (descarga + extracción de audio + Whisper falló).

**How to apply:**
- Si vas a iniciar trabajo en un worktree y la tarea toca clips, transcripción, secretos, magic links o cualquier ruta `/api/`, verifica `ls <worktree>/.env` primero.
- Si no existe, copia desde el principal antes de que el usuario levante dev.
- Si el usuario ya levantó dev y aparece `"OPENAI_API_KEY":false` en el log [config], esa es la señal — copiar y reiniciar (nodemon no recarga `.env`).
