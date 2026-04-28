---
name: Comando habitual de arranque local
description: Cómo levanta el usuario el servidor de AS Tools en local
type: feedback
originSessionId: b0c3143d-40d0-400c-a188-8cc733c166bf
---
El usuario levanta AS Tools en local con `./start.sh` (script en la raíz del repo), no con `npm run dev` directo.

**Why:** El script verifica dependencias del sistema (node, ffmpeg, yt-dlp, markitdown), crea aviso si falta `.env`, abre el navegador automáticamente en http://localhost:5173, y muestra un banner con las URLs de app y API.

**How to apply:** Cuando se necesite arrancar el entorno local, sugerir/usar `./start.sh`. Cuando se añadan nuevas dependencias del sistema o variables de entorno críticas, considerar añadir un check al script.
