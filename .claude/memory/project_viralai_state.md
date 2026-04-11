---
name: Estado actual de ViralAI v2.1.0
description: Resumen del estado del proyecto ViralAI a abril 2025
type: project
---

ViralAI v2.1.0 — App de transcripción de video con autenticación.

**Stack:** React 18 + Vite + Tailwind (frontend), Express 5 (backend), SQLite3 (DB), OpenAI gpt-4o-mini-transcribe (transcripción), yt-dlp + FFmpeg (extracción de audio).

**Features activas:** Transcribir (URL de YouTube/IG/TikTok/Facebook + subir archivo), Mis Resultados (historial por usuario), Admin (costos, solo owner).

**Auth:** JWT + bcryptjs. Primer registro = owner, resto = member. Cada usuario ve solo sus transcripciones.

**Deploy:** Render con Docker (node:22-slim + build-essential para sqlite3). DB en /opt/data/viraler.db.

**Why:** Julian usa esta app para transcribir contenido de creadores y generar ideas de contenido viral.
**How to apply:** Cualquier cambio debe mantener esta arquitectura simple. No agregar ORMs, no migrar a Postgres, no agregar frameworks de auth complejos.
