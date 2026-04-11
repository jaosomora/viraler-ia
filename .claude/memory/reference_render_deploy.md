---
name: Deploy en Render
description: AS Transcribe se despliega en Render con Docker, datos persistentes en /opt/data
type: reference
---

- Repo: github.com/jaosomora/as-transcribe
- Deploy: Render con Docker (Dockerfile en raíz)
- Datos: /opt/data/as-transcribe.db (disco persistente en Render)
- Env vars necesarias en Render: OPENAI_API_KEY, JWT_SECRET, NODE_ENV=production
- Branch de deploy: main
- El build incluye --build-from-source para sqlite3 (glibc compatibility)
