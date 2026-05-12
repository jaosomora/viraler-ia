---
name: AS Reels Cleaner - Estado
description: Estado actual de AS Reels Cleaner (nueva herramienta en AS Tools): qué está hecho, qué está integrado, qué quedó fuera del MVP por decisión consciente.
type: project
---

AS Reels Cleaner está LIVE en producción y completamente integrado al ecosistema AS Tools.

**Why:** Tercera herramienta del flujo de Julián con clientes — el cliente envía toma cruda corta (cliente graba un guion, ≤10 min), el sistema entrega un reel limpio listo para IG/TikTok sin pasar por CapCut o herramienta externa.

**How to apply:** No volver a proponer features ya hechas. Solo trabajar sobre lo que aún no está en esta lista.

## Lo que está completo (Mayo 2026)

**Pipeline:**
- 3 pasos: Silencios → Estilo → Música → Done
- Whisper-1 transcribe; silenceDetector arma keep-segments con padding 100ms para no comer ataques consonantes
- Render 2 pasos modelo Clips: base.mp4 (cuts+crop, sin subs) + burnSubsOnBase (subs quemados)
- Mezcla música con `sidechaincompress` para auto-ducking
- States: pending → running → awaiting_review → rendering_base → awaiting_style_review → awaiting_music_review → rendering_music_mix → done

**WYSIWYG paso 2:** base.mp4 + overlay HTML con `text-shadow` simulando ASS outline. Cambios de fuente/tamaño/color/grosor/posición se ven al instante sin re-render. Solo se quema al continuar a música.

**Audición pre-render paso 1:** botón "▶ Escuchar cómo queda" con requestAnimationFrame que salta cortes en vivo (~16ms lag). El usuario audita antes de pagar render.

**Música:**
- Catálogo `music_tracks` con tracks remotos (Jamendo lazy download) o subidos manual
- Sugerencia IA: GPT-4o-mini con fallback Claude Sonnet 4.5 si hay ANTHROPIC_API_KEY. Usa índices numéricos (no IDs) para evitar alucinación.
- 50+ tags en mood/energía/género, multi-select para filtros
- Mini-player sticky con progress/volumen/seek
- Curaduría: 35 recetas con paginación automática por internal-tag

**Tracking de costos:**
- Por job: whisper_cost_usd, llm_cost_suggest_usd, total_cost_usd
- Agregado en `usage_stats`: reels, reels_minutes, reels_cost (por día)
- trackReelUsage() se llama en finalize()

**Integración paneles:**
- Tab "Reels" en /mis-resultados (SavedReels component)
- Tab "🎵 Reels" en /admin (ReelsAdmin: stats cards + tabla con filtros)
- "Modelos de IA en uso" muestra: Whisper, GPT-4o-mini sugerencias, Claude Sonnet, Jamendo
- Historial de uso del Resumen incluye columna "Reels" sumando minutos+costo

**Producción (Docker):**
- /opt/data/reels/<jobId>/ (purge automático 24h o pressure 85%→70%, mismo cleanupService)
- /opt/data/music/<trackId>.mp3 (permanente, no se purga — es biblioteca del owner)
- render.yaml expone JAMENDO_CLIENT_ID, ANTHROPIC_API_KEY (sync:false, opcionales)
- Dotfile fix: res.download usa `{ dotfiles: 'allow' }` para que descarga funcione en worktrees con `.claude/` en el path

## Lo que quedó fuera del MVP (decisión consciente, no hacer sin confirmar)

- **Slider de padding por reel**: hay padding global de 100ms hardcoded. Si "Nacen" se sigue comiendo en muchos reels, exponerlo como slider. Mientras tanto el chip "Mantener" suple.
- **Re-aplicar ediciones de texto tras volver a silencios**: caption_overrides van por idx, no por matching de contenido. Documentado en el alert al volver atrás + botón "📋 Copiar transcripción" como workaround.
- **Búsqueda Pixabay/Freesound/YouTube Audio Library en vivo**: solo Jamendo está integrado. Pixabay no tiene API pública de audio. Freesound es SFX. YouTube AL no tiene API.
- **Generación de música con IA (Suno/Mubert/Udio)**: descartado por calidad impredecible y costo por minuto. Si se pide, recordar el motivo.
- **Resistencia de ediciones a re-corte (matching por contenido)**: tras razonarlo, descartado — el caso típico es cuando el cut cambia el contenido del chunk (ej: agrega palabra), donde matching tampoco aplicaría.
- **Comparación A/B de mezclas de música**: solo se guarda 1 mezcla en disco a la vez; cambiar de track sobrescribe.

## Reusos clave (no duplicar)

- whisperService.js, extractAudioFromVideo, orthographyCleanup.js de Clips
- chunkWordsForClip de captionsService (Clips)
- FONT_CATALOG.caption de subtitleGenerator (Clips)
- Modelo render-en-2-pasos (base + burn-in) de Clips
- authMiddlewareMedia para endpoints de streaming con token en query
- cleanupService extendido para reels (mismo patrón clips)
