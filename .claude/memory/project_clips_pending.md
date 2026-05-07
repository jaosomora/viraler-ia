---
name: AS Clips - Estado y pendientes
description: Estado actual de AS Clips después de las 4 fases de evolución (mayo 2026). Lista priorizada de pendientes reales restantes.
type: project
originSessionId: 3f28eee2-7029-453e-af76-ef77d8f43da0
---
AS Clips evolucionó en 4 fases en mayo 2026 (branch `claude/pensive-nobel-cc0d12`). Hoy es un editor de subtítulos virales tipo Opus Clip pero con estética editorial elegante, NO la energía neón/loud de Opus/Submagic. El usuario quiere que el contenido proyecte madurez y oficio.

**Why:** El usuario sigue iterando AS Clips y prioriza la calidad estética del MP4 final + UX del editor sobre nuevas features.

**How to apply:** Cuando retomes AS Clips, NO empieces a sumar features. Primero confirma con el usuario qué falta de la lista de pendientes y qué ya cumple. La estética "Algo Sentido" es: warm, muted, editorial, sin neón, sin highlights chillones.

## Lo que YA está construido (no proponer de nuevo)

### Modelo Opus Clip (split base + export)
- Pipeline split: `renderClipBase` (cut + crop + zoompan, sin subs, generado 1 vez) + `burnSubtitlesOnBase` (.ass burn-in on-demand al exportar). Edición en vivo en HTML overlay sin re-render. `clips.render_mode = 'overlay' | 'burned-legacy'`. `base_video_path`, `base_params_hash`.
- Endpoints: `GET /captions`, `GET /base-video`, `POST /export`. Auto-persist debounced cuando cambian trim/aspect/camera/transition (params del base).

### Editor en vivo + capa de subtítulos
- `LiveCaptionOverlay` con rAF, sincronizado a `<video>`.
- `TranscriptProseView`: vista prosa con click-to-seek por palabra, chunk activo resaltado en lila.
- `CaptionChunkEditor`: lista editable, override de texto, ocultar, reset al original. Persiste en `clips.caption_overrides` JSON.
- Word-active highlight en preview (scale 1.08 + brightness sobre la palabra que se dice ahora).
- Pop animation del chunk al cambiar (CSS keyframes en preview + `\fad\\t\\fscx` en .ass).

### Estilo granular del texto (UI + .ass + preview)
- Color, tamaño px, italic, underline para hook/caption/keyword separados.
- Background color con opacity para keyword (estilo marcador). Truco ASS de outline grueso para burn-in.
- Outline color independiente del color del texto (no más texto-negro-sobre-outline-negro).
- Karaoke: `\k<dur>` per-word en .ass + SecondaryColour atenuado. UI toggle + slider de dim opacity. Solo se ve en MP4 exportado, no en preview.

### Transiciones (validadas con export real)
7 modos: none, fade-in, fade-out, fade-cross, zoom-in, zoom-out, zoom-cross. Fades = ffmpeg `fade=t=in/out`. Zooms = expresión `zoompan` que pisa al camera_motion en los bordes (0.5s). `TransitionFader` simula fades en preview con CSS opacity.

### Plantillas elegantes (NO Opus Clip bro)
5 templates con estética editorial Algo Sentido: **Editorial** (Playfair + Lora + Playfair Italic + crema + oro envejecido `#C9A961`), **Documentary** (Inter neutro TED-style), **Boutique** (Lato + DM Serif Italic + oro metálico `#D4AF37`), **Whisper** (Inter Regular pequeño sin outline), **Manuscrito** (EB Garamond + Caveat + terracota). Aplicar a 1 clip o a todos (shift+click o botón "→ todos"). Plantillas user-defined: tabla `clip_templates`, "+ Guardar este estilo".

**Default de clips nuevos = Editorial** (Playfair Display + Lora SemiBold + crema + oro envejecido + outline 2). Antes nacían con Anton + Inter SemiBold + amarillo neón + outline 5.

### Catálogo de fuentes empaquetado
- 30 TTFs en `assets/fonts/` (variable + static). `scripts/download-fonts.sh` los baja desde google/fonts repo. **Crítico**: antes el burn-in caía a fallback del sistema (DejaVu en Linux); ahora preview ↔ MP4 final coinciden visualmente.
- Catálogo: 19 fuentes caption agrupadas por carácter (sans neutras / sans con personalidad / serifs editoriales) + 20 fuentes keyword (italics serif / sans fuertes / display). Cada ID describe el carácter en su nombre.
- Single source of truth: `FONT_FAMILY` + `FONT_WEIGHT` + `FONT_ITALIC` exportados desde `LiveCaptionOverlay.jsx`, importados por `ClipEditor`, `ClipCard`.

### UX del editor reorganizada
- 5 secciones colapsables: 📝 Texto / 🎨 Estilo / 💬 Subtítulos / 🎬 Movimiento / 📐 Salida. Estado abierto/cerrado persistente en localStorage.
- `Tooltip` con `?` en conceptos no obvios (Hook, Keywords, Cámara vs Transición, Borde, Karaoke).
- Plantillas siempre visibles arriba (atajo a estética completa).

### Banner gancho auto + toggle
- Banner en ClipsPage al terminar un job: "Gancho auto añadido a los X clips · Desactivar / ✕". Endpoint masivo `POST /jobs/:id/disable-hooks`. Toggle por clip "Mostrar gancho en el video" en el editor.

### Recovery de jobs zombie
- `recoverZombieJobs()` corre al startup del server. Cualquier job con status NOT IN ('done','error') → marcado error con mensaje "Interrumpido por reinicio del servidor". Soluciona el caso de nodemon/deploy interrumpiendo trabajos en vuelo.

## Pendientes que SIGUEN pendientes (orden sugerido)

### Alto impacto

1. **Diarización real con AssemblyAI + layout split top/bottom** (cuando hay 2-3 hablantes, dividir clip vertical y mostrar el speaker activo). El usuario ya pidió esto explícito con un Facebook Live de James Gullo.
2. **Tracking facial dinámico** para crop dinámico (MediaPipe en Python subprocess, patrón markitdown). Hoy crop es centro fijo.
3. **Detección automática de color de texto según fondo** (sample 3-5 frames + análisis luminance + sugerir contraste).
4. **PySceneDetect** para filtrar/score clips ruidosos (>3 cortes en 60s baja el score).

### Mejoras del editor

5. **Subir fuente propia (.ttf/.otf)** con disclaimer de licencia. Tabla `custom_fonts`, multer endpoint, fontsdir dinámico en ffmpeg.
6. **"+ Mi prompt" funcional** para frameworks de copy del usuario (tabla `user_prompts`, selector en chips de tono que ejecuta su prompt).
7. **Karaoke real en preview** (hoy es solo en MP4 exportado). Requiere CSS animation per-word con timing exacto.
8. **Reagrupar/partir chunks de subtítulos** (hoy timestamps de chunks no son editables, solo el texto y hidden).

### Backend / infra

9. **Auto-cleanup de jobs >30 días** con cron diario (consistente con tabla secrets).
10. **Logs persistentes en DB del pipeline** — tabla `clip_job_logs` (job_id, stage, message).
11. **POST /api/clips/jobs/:id/retry** para reintentar jobs fallidos sin perder configuración.
12. **Cover/poster del video** (frame + overlay como JPG separado para usar como thumbnail en IG/YouTube).

### Cambios estructurales considerados (decidir después)

- Selector de **weight independiente** en el dropdown (hoy el weight viene baked en el ID). Requiere refactor del catálogo a (family, weight, italic) en vez de IDs únicos.
- **Variantes de transición entre clips** cuando el usuario quiera concatenar 2 clips en un solo MP4. Hoy cada clip es un export independiente.

## Notas técnicas

- Branch actual: `claude/pensive-nobel-cc0d12` en worktree.
- DB en `data/as-transcribe.db` (worktree) o `/opt/data/as-transcribe.db` (Render prod).
- Files en `data/clips/<jobId>/`: `source.mp4`, `whisper.json`, `<clipId>_base_<res>.mp4` (sin subs), `<clipId>_export_<res>.mp4` (con subs quemados al exportar), `<clipId>.ass`.
- Para forzar re-render: borrar `output_path` y `base_video_path` o cambiar params del base (trim/aspect/camera/transition).
- Scripts de validación en `scripts/`: `download-fonts.sh`, `test-transitions.mjs`, `test-pop-animation.mjs`, `test-karaoke.mjs`.
- Tablas: `clip_jobs`, `clips`, `clip_templates` (user-defined templates).
