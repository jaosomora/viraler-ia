---
name: AS Clips - Estado y pendientes
description: Estado actual de AS Clips después de las 4 fases de evolución (mayo 2026) + iteración de pipeline de selección (mayo 9 2026, worktree `elastic-shirley-15b5b7`). Lista priorizada de pendientes reales restantes.
type: project
originSessionId: 3f28eee2-7029-453e-af76-ef77d8f43da0
---
AS Clips evolucionó en 4 fases en mayo 2026 (branch `claude/pensive-nobel-cc0d12`) + una 5ª iteración el 2026-05-09 (branch `claude/elastic-shirley-15b5b7`) enfocada en la **calidad de selección de clips** (no rendering). Hoy es un editor de subtítulos virales tipo Opus Clip pero con estética editorial elegante, NO la energía neón/loud de Opus/Submagic. El usuario quiere que el contenido proyecte madurez y oficio.

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

### Pipeline de selección de clips v2 — dos pases con segmentación de capítulos (2026-05-09)
Reescritura completa de `api/clips/highlightService.js`. Antes: 1 sola llamada a gpt-4o sobre todo el transcript → producía intros del programa como "clips", listas habladas, clips de 8-18s, cierres cortados.

**Arquitectura nueva (dos pases):**
1. **Pase 1 — `segmentChapters`** (gpt-4o-mini): segmenta el video en capítulos por tipo: `intro` / `desarrollo` / `transicion` / `cierre`. Costo ~$0.005. Las intros del programa, transiciones y cierres quedan excluidos por construcción.
2. **Pase 2 — `generateHighlights`** (gpt-4o): solo recibe los capítulos `desarrollo` con marcadores `[CAPÍTULO: <título>]`. Regla: **máx 1 clip por capítulo** → diversidad garantizada estructuralmente.

**SYSTEM_PROMPT reforzado** con:
- **Regla de duración al inicio** (la más violada): rango duro 30-90s, óptimo 35-55s. Fórmula SETUP (5-15s) + IDEA (10-30s) + CIERRE (5-15s).
- **6 criterios no negociables**: hook en 3s, autocontenido, una sola idea, carga cognitiva, cierre con peso, duración.
- **Descartes por categoría con ejemplos literales**:
  - A) Arrancadores prohibidos: "Así es", "Fíjate que", "Como bien lo mencionabas", "Entonces", "Bueno", "Y pues", etc.
  - B) Intro/cierre de programa
  - C) Listas habladas (detecta "primera/segunda etapa" en CUALQUIER parte del clip, no solo inicio)
  - D) Contenido hueco (verdades genéricas, coachismo, anécdotas sin payload)
- **Arco interno explícito**: identificar pico → construir clip centrado en él, no usar el capítulo entero como clip.
- **Tono Algo Sentido**: editorial/reflexivo/adulto. PROHIBIDO emojis, mayúsculas dramáticas, clichés de coach, CTAs de venta.
- **Hooks literales del audio** (sincronía hook on-screen ↔ primeros 3s de habla).
- **Hashtags específicos al nicho**: evita #motivación #mindset; prefiere #paternidad #duelo #vocación.

**Defensas en código:**
- Filtro post-snap: clips con duración fuera de [25s, 100s] se descartan con `console.warn` (margen sobre 30-90 del prompt por redondeo).
- `retreatEndIfContinuation`: si el último segmento del clip empieza con conector (`entonces`, `pues`, `bueno`, `partiendo de eso`, etc.), retrocede `end_seconds` hasta 3 segmentos hasta encontrar cierre genuino.

**Costo total por video:** ~$0.085-0.09 (Whisper $0.06 + cleanup $0.003 + chapters $0.005 + highlights $0.022). Subió ~$0.005 vs antes pero la calidad subió mucho más.

**Resultado validado (2026-05-09):** video de YouTube de 21min sobre Zen → 3 clips entregados (45s, 50s, 54s), todos con score 82-88. Cada uno de un capítulo distinto. Hooks literales. Cierres con peso. Cero listas. Cero intros del programa. Cero clips estirados/cortos. Aprobado por el usuario.

### Cleanup ortográfico paralelizado (2026-05-09)
`api/clips/orthographyCleanup.js`: antes mandaba TODO el transcript en una sola llamada con timeout 60s → fallaba en videos >10min. Ahora:
- Chunks de 30 segmentos, 4 en paralelo, timeout 45s por chunk.
- Si CUALQUIER chunk falla, fallback al original (preserva sync `words[]` ↔ `segments[]`).
- Tiempo: video de 10min antes ~60-100s (timeout). Ahora ~20-30s estable.

### Progress logging de yt-dlp (2026-05-09)
`api/clips/videoProcessor.js`: `downloadVideoToPath` ahora acepta callback `onProgress({pct, size})`. Parsea líneas `[download] X% of YMiB` en stdout Y stderr (versiones nuevas de yt-dlp envían a stderr). Flag `--newline` para forzar 1 línea por update. Reporta cada 10% para no spamear el log. Cliente en `clipsService.js` loggea `download X% of YMiB`.

### Dependencia externa: yt-dlp 2026.03.17
Mac con dual Homebrew (Intel `/usr/local` + ARM `/opt/homebrew`). yt-dlp Intel viejo (2025.03.27) fallaba con `nsig extraction failed` + 429. Solución: `brew install yt-dlp` en ARM brew → 2026.03.17. PATH ya tenía `/opt/homebrew/bin` primero, no hay que tocar PATH. Spawn resuelve nuevo binario sin reiniciar nodemon.

### Modo manual de selección de clips (2026-05-11)
Branch `claude/manual-clip-selection` (worktree `.claude/worktrees/manual-clip-selection/`). Agrega una segunda forma de generar clips además del pipeline automático.

**Flujo:** form muestra toggle "¿Quién elige qué va en los clips?" con dos cards: "✨ Automático IA" (default, comportamiento histórico) y "✂️ Yo elijo". En manual, tras Whisper+cleanup el job pausa en `status='awaiting_selection'` y `clipsService.processJob` retorna. El polling del context lo detecta y `ClipsPage` renderiza `<ManualClipSelection>` en vez de `<JobProgress>`. Backend reanuda al recibir `POST /api/clips/jobs/:id/submit-ranges`.

**Interacción de selección (decidida con mockups):**
- Layout single-page con secciones colapsables (mismo patrón del editor de clips), no stepper de pantallas separadas.
- Click-click: 1er click marca inicio, 2do click cierra el rango y se agrega automáticamente. cmd/ctrl+click reservado para "agregar otro sin perder el actual" (no implementado aún).
- Snap a fronteras de segmento Whisper + `retreatEndIfContinuation` (mismo set de conectores que el auto: entonces, pues, bueno, ahora, así que, por eso, partiendo de eso, y luego, y después, por tanto).
- Warning **soft** (no bloquea) si fuera de [30s, 90s] — la filosofía es "tu video, tu criterio". Backend solo rechaza fuera de [10s, 120s] (rango duro más permisivo que el auto de [25, 100]).
- Hook + caption + keywords + post_captions opcional con gpt-4o-mini ($0.001/clip). Toggle en el form, ON por default. Si OFF, los clips nacen con strings vacíos y el usuario los rellena en el editor existente.

**"Agregar más clips" a un job done:** botón ámbar en el header del job done. Llama `POST /api/clips/jobs/:id/reopen-for-selection`, que valida que `whisper.json` y `source.mp4` sigan en disco, cambia `mode='manual'` y `status='awaiting_selection'`. Reutiliza el transcript existente (no paga Whisper otra vez). `resumeManualJob` arranca `clip_index` desde `MAX+1`, solo renderiza clips con `base_video_path` NULL (los viejos se preservan), recalcula `total_clips = COUNT(*)`. Hack en `ClipsContext.reopenForSelection`: `setActiveJobId(null) → loadJob → setActiveJobId(jobId)` para forzar reinicio del polling effect que se había detenido al llegar a `done`.

**DB migrations añadidas a `api/database/schema.js`:**
- `clip_jobs.mode TEXT DEFAULT 'auto'` — 'auto' | 'manual'
- `clip_jobs.manual_ranges TEXT` — JSON [{start,end}] auditoría
- `clip_jobs.hook_auto_enabled INTEGER DEFAULT 1`

**Schema bug latente arreglado de paso:** `CREATE TABLE clips` estaba DESPUÉS de los `ALTER TABLE clips ADD COLUMN ...` en el archivo. En DBs existentes funcionaba (clips ya existía), pero en cualquier DB nueva (clone limpio, worktree fresco, CI) los ALTER fallaban silenciosamente y la tabla nacía sin `post_captions_cache`, `render_mode`, `hook_color`, etc. → INSERTs explotaban. Movido `CREATE TABLE clips` arriba de los ALTERs.

**Costos:** Modo manual ahorra ~$0.027 vs auto (saltea chapters + highlights LLMs). Total típico: $0.06 (Whisper) + $0.003 (cleanup) + $0.001 × N (hooks opcionales) ≈ $0.063 para 3 clips.

**Archivos clave del feature:**
- `api/clips/highlightService.js`: `snapRangeToSegments`, `generateHookForRange` (gpt-4o-mini con prompt editorial Algo Sentido)
- `api/clips/clipsService.js`: `processJob` con branch manual, `resumeManualJob`, `reopenJobForSelection`
- `api/clips/routes.js`: `submitRangesHandler`, `getTranscriptHandler`, `reopenForSelectionHandler`
- `src/components/ManualClipSelection.jsx`: UI completa de selección (transcript prose + panel rangos + CTA)
- `src/components/ClipsForm.jsx`: toggle de modo
- `src/context/ClipsContext.jsx`: `fetchTranscript`, `submitRanges`, `reopenForSelection`

**Player de video + auto-sync (iteración 2026-05-11):** la pantalla de selección manual incluye `<video>` sticky arriba del transcript. Backend: nuevo endpoint `GET /api/clips/jobs/:id/source-video` con soporte de **Range requests** (HTTP 206) — sin Range el browser bajaría todo el archivo antes de poder seekear. Auth via `authMiddlewareMedia` (nuevo en `api/auth.js`) que acepta token también como `?token=` query param porque el `<video>` tag no manda Authorization headers. Frontend: `videoRef`, `currentTime` state actualizado por `onTimeUpdate`, click en palabra → `videoRef.current.currentTime = t.start`, palabra activa (cuyo `[start, end]` contiene currentTime) renderizada con bg morado. Auto-scroll via `useEffect` que dispara cuando cambia la palabra activa, usa `scrollIntoView({behavior:'smooth', block:'center'})`. Detección de scroll manual con flag `isProgrammaticScroll.current` (true durante 800ms tras cada scrollIntoView programático): si llega un evento de scroll sin el flag, es del usuario → `setAutoFollow(false)`. Botón "↩ Volver al momento del video" reactiva. **Bug que arreglé**: temporal dead zone — el useEffect del auto-follow referenciaba `wordTokens` que se declaraba con `useMemo` más abajo en el componente. Movido el useEffect después del useMemo.

**Pendiente Sprint 2:** modo híbrido (manual + IA propone N extra). UX mobile alterna (botones marcar inicio/fin sobre video sticky). Editar timestamps de chunks. Cancelar selección en curso si el usuario cambia de opinión.

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

- Branch activo (2026-05-09): `claude/elastic-shirley-15b5b7` en worktree `.claude/worktrees/elastic-shirley-15b5b7`. Branch anterior con rendering work: `claude/pensive-nobel-cc0d12`.
- DB en `data/as-transcribe.db` (worktree) o `/opt/data/as-transcribe.db` (Render prod).
- Files en `data/clips/<jobId>/`: `source.mp4`, `whisper.json`, `<clipId>_base_<res>.mp4` (sin subs), `<clipId>_export_<res>.mp4` (con subs quemados al exportar), `<clipId>.ass`.
- Para forzar re-render: borrar `output_path` y `base_video_path` o cambiar params del base (trim/aspect/camera/transition).
- Scripts de validación en `scripts/`: `download-fonts.sh`, `test-transitions.mjs`, `test-pop-animation.mjs`, `test-karaoke.mjs`.
- Tablas: `clip_jobs`, `clips`, `clip_templates` (user-defined templates).

### Bug conocido (no bloqueante, no aprobado para fix aún)
**Whisper stutter** — `gpt-4o-mini-transcribe` a veces repite la última palabra de un segmento al inicio del siguiente, dejando duplicados en el transcript: "Intermediarios. Intermediarios", "Decidiendo Decidiendo", "grande grande". Solo aparece en el JSON crudo + transcripción visible, NO en los subtítulos quemados (chunking de Whisper colapsa los duplicados al renderizar .ass). El usuario confirmó subs limpios el 2026-05-09. Si en el futuro se queja: añadir paso de dedup en `cleanupOrthography` que detecte palabras idénticas consecutivas y elimine la duplicada.
