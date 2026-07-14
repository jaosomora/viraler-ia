# Algo Sentido Tools - Claude Code Project Context

## What is this project?
AS Tools (Algo Sentido Tools) is a full-stack web app with multiple internal tools:
1. **Transcribe** — Extracts video transcriptions from YouTube, Instagram Reels, TikTok, and Facebook. Tras transcribir desde URL, el usuario puede **descargar el video original** en MP4 (botón en `TranscriptionResults`, endpoint `POST /api/download-video`, límite 30 min validado con `yt-dlp --dump-json` antes de descargar).
   - **Ficha del video**: el endpoint captura del JSON de yt-dlp métricas de engagement (`view_count`, `like_count`, `comment_count`, `repost_count`), datos del autor (`uploader_id`, `uploader_url`, `upload_date`), `description` y `hashtags`. Persistidos en columnas nuevas de `transcriptions`. Renderizados en `VideoMetadataCard.jsx` (thumbnail + chips + description colapsable). YT/TikTok devuelven todo sin cookies; IG/FB pueden venir parciales sin cookies y la ficha solo muestra lo que haya — si no hay ninguna señal, no se renderiza.
   - **Análisis de ideas on-demand**: tras transcribir, el botón "✨ Analizar ideas" llama `POST /api/transcriptions/:id/analyze` (idempotente: `?force=true` regenera). `api/services/analysisService.js` invoca `gpt-4o-mini` con un system prompt enfocado en **replicar**, no auditar: entrega solo (a) idea pelada + lógica en 2 líneas, y (b) molde paso a paso con corchetes `[en negrita]` para que el usuario rellene con su tema/voz/sector. El prompt prohíbe jerga de marketing ("engagement", "viralidad", "espectador") y exige observar el transcript real antes de armar el molde (no plantillar genérico). El análisis se guarda en columnas `analysis`, `analysis_at`, `analysis_model`, `analysis_cost_usd` y se cuenta en `usage_stats.analyses` + `analyses_cost`. Renderizado en `VideoAnalysisPanel.jsx` con botones Copiar (markdown crudo) y Regenerar. Costo: ~$0.002 por análisis. AdminPanel tab Resumen muestra contador + costo agregado; tab Transcripciones muestra badge "✨ Analizado" y expande el análisis junto al texto.
2. **Convert** — Converts documents (PDF, DOCX, PPTX, XLSX, EPUB) to Markdown / HTML / structured PDF (MarkItDown + pymupdf4llm)
3. **Secretos** — Encrypted secret sharing (AES-256-GCM): any logged-in user creates a secret, gets a one-time link; only the owner can decrypt. 30-day auto-expiry.
4. **AS Clips** — Convierte videos largos en clips verticales con subs estilo Instagram. **Dos modos de selección**:
   - **Automático**: pipeline de 2 pases (segmentChapters + generateHighlights) elige los mejores momentos por el usuario.
   - **Manual** ("Yo elijo"): tras transcribir, el job pausa en `status='awaiting_selection'`; el usuario marca rangos en el transcript con click-click (1er click=inicio, 2do=fin), backend snap a fronteras de palabra + retreat de cierres con conectores, filtro duro 10-120s, hook+caption+post_captions opcional con gpt-4o-mini ($0.001/clip). Soft warning si rango fuera de 30-90s pero permite generar igual. Botón "✂️ Agregar más clips" en jobs done reabre el job sin re-transcribir.
   - **Player + auto-sync en selección manual**: la pantalla incluye reproductor del video fuente sticky (endpoint `/source-video` con Range requests vía `authMiddlewareMedia` que acepta token en query). Click en palabra → seek instantáneo. Mientras reproduce: palabra activa se ilumina morada y el transcript scrollea solo manteniéndola centrada. Scroll manual pausa el auto-sync (no se pelea con el usuario) y aparece botón "Volver al momento del video" para reactivar.
   - **Encuadre horizontal del crop** (columna `clips.crop_x_pct` INTEGER DEFAULT 50): para fuentes con dos personas lado a lado (entrevistas Zoom), el crop centrado tradicional caía entre ambas. Cada clip persiste `crop_x_pct` (0=borde izq · 50=centro · 100=borde der). `buildCropExpr(aspect, pct)` en `videoProcessor.js` (función pura, testeada) genera `crop=ih*9/16:ih:(iw-ih*9/16)*pct:0` y se usa en `renderClip` + `renderClipBase`. El valor está en `baseParamsHash` → cambiar el encuadre regenera el base. UI en `ClipEditor.jsx` sección "Movimiento y transiciones": 3 presets Izquierda/Centro/Derecha + slider para ajuste fino, auto-persiste con debounce. Backwards-compatible con clips antiguos (default 50 reproduce el comportamiento histórico `crop=ih*9/16:ih`).
5. **AS Reels Cleaner** — Toma cruda corta (≤10 min) → reel vertical 9:16 con cortes de silencio + subs IG + música opcional. Flujo de 3 pasos con WYSIWYG en vivo:
   - **Paso 1 · Silencios**: tras transcribir con Whisper, detecta gaps entre palabras (`api/reels/silenceDetector.js`). Frontend muestra transcript con chips por pausa (✂ Cortar / ⚠ Revisar / Mantener) + slider de umbral global. **Trim cabeza/cola**: panel "Recortar inicio y final" con dos inputs `mm:ss` y botón **"Aquí"** que usa el tiempo actual del player (para final calcula `totalDur - currentTime`); los recortes son dos cortes anclados a `start: 0` y `end: totalDur` que se mergean con los demás. Botón **"▶ Escuchar cómo queda con los cortes aplicados"** salta cortes en vivo vía `requestAnimationFrame` (~16ms lag) sin render — el usuario audita antes de pagar el cómputo. **Padding asimétrico**: cortes internos llevan 100ms a cada lado (no comer ataques consonantes); cortes anclados a borde (start=0 o end=duration) son **exactos sin pad** — Whisper marca arranque/fin con precisión ~10ms y el usuario espera trim quirúrgico, no colita de silencio. Solo se renderizan chips inline para gaps **internos**; los leading/trailing se gestionan desde el panel de trim (evita duplicar UI). Auto-scroll del transcript siguiendo la palabra activa (zona segura 10–80%).
   - **Paso 2 · Estilo de subs**: render del `base.mp4` (cuts + concat + crop 9:16 + scale 1080×1920, sin subs) en una sola pasada con ffmpeg `filter_complex` (`trim/atrim → concat → crop`). **Rotación**: ffmpeg autorrota al decodificar pero el `concat` filter cuela el `displaymatrix` side_data del input al output → el navegador rota dos veces y se ve sideways. Fix: tras el render, segunda pasada `-display_rotation:v 0 -c copy` que reescribe el contenedor sin esa metadata (no re-encodea, <1s). Frontend muestra base + **overlay HTML WYSIWYG** que renderiza el chunk activo con la fuente/tamaño/color/grosor/posición que estás eligiendo. Cambios instantáneos sin re-render. **Posición** vía 5 presets (Pegado abajo / Bajo / Medio / Alto / Casi mitad) con indicador rojo/ámbar/verde de zona segura IG+TikTok. **Toggle "Zonas IG/TikTok"** overlay el preview con bandas que muestran el UI de cada plataforma. Subtítulos línea por línea editables con timestamps clickeables, ocultable por chunk, **botón "📋 Copiar transcripción"**.
     - **Procesamiento de voz** (`VoicePanel`, columnas `voice_autolevel` BOOL default 1 + `voice_gain_db` INT default 0): card 🎙️ Voz para fuentes con audio bajo/desnivelado. **Auto-nivelar** (default ON) aplica `loudnorm=I=-16:TP=-1.5:LRA=11` (estándar IG/TikTok, limiter integrado, sin clipping). **Ajuste fino** slider −6..+12 dB con 6 chips preset → `volume=XdB` encima del loudnorm. `buildVoiceAudioFilter()` en `reelRenderer.js` es la lógica pura (devuelve `null` = passthrough → audio `-c:a copy`, cero costo). El filtro se aplica dentro de `burnSubsOnBase` (re-encode de audio en la misma pasada del burn-in, sin paso extra), así la mezcla de música downstream consume voz ya nivelada y el `sidechaincompress` dispara consistente. **Botón "▶ Escuchar muestra"**: `POST /api/reels/jobs/:id/voice-sample` → `renderVoiceSample` extrae 10s de mp3 con el procesamiento actual (~1-2s, no toca video), el frontend lo reproduce vía Blob URL. Costo $0 (filtros ffmpeg, sin API). Cambiar voz marca `preview_dirty`; se aplica al continuar a música o re-renderizar.
   - **Paso 3 · Música de fondo (opcional)**: catálogo `music_tracks` con tracks remotos de Jamendo (lazy download al primer uso) o subidos manual. **Sugerencia IA** (GPT-4o-mini con fallback a Claude Sonnet 4.5 si hay `ANTHROPIC_API_KEY`) lee el transcript + catálogo numerado y devuelve 3 sugerencias variadas con razón. Mixer ffmpeg con `sidechaincompress` para auto-ducking (la música baja cuando hablas). Mini-player sticky con progreso/volumen/seek. Curaduría predefinida con `~35 recetas` por mood + paginación automática (cada click trae página siguiente).
   - **Estados**: `pending → running → awaiting_review → rendering_base → awaiting_style_review → awaiting_music_review → rendering_music_mix → done`. Cleanup automático extendido a `/opt/data/reels/<jobId>` con misma política que clips (24h + 85% pressure → 70%).
   - **Catálogo de música**: `/opt/data/music/<trackId>.mp3` (permanente, no se purga). 50+ tags agrupados en mood/energía/género (`api/reels/musicTags.js`). Solo tracks instrumentales (filtro `vocalinstrumental=instrumental` en Jamendo).
   - **Reusos clave**: `whisperService.js`, `extractAudioFromVideo`, `orthographyCleanup.js`, `chunkWordsForClip`, `FONT_CATALOG.caption` de Clips. El modelo de render-en-2-pasos (base + burn-in) también es de Clips.

Auth: email+password (bcrypt+JWT) plus magic link login by email (Resend, 15min single-use). First registered user becomes `owner`.

**Acceso temporal por usuario** (para clientes): el owner asigna `access_expires_at` desde el panel admin (tab Usuarios). El `authMiddleware` valida la expiración contra DB en cada request (owner exento). Login y magic link rechazan usuarios expirados con mensaje claro. NULL = sin límite (uso interno). Endpoint: `PATCH /api/admin/users/:id/access`.

**Panel admin con tabs** (`/admin`): organizado en Resumen / Usuarios / Transcripciones / Clips / **Reels** / Conversiones / Secretos. El tab activo se persiste en `localStorage` (clave `admin_active_tab`). El **Resumen** integra "Modelos de IA en uso" (Whisper, GPT-4o-mini, Claude Sonnet, Jamendo) y "Historial de uso reciente" con totales agregados por día across todas las herramientas. **Mis Resultados** tiene tabs Transcripciones / Clips / Reels / Conversiones.

Part of the Algo Sentido internal toolset. Designed to scale with more tools over time.

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js, ESM modules)
- **Database**: SQLite3 (file-based, `data/as-transcribe.db`)
- **AI/LLM**: Anthropic Claude API + OpenAI API (fallback via `LLM_PROVIDER` env)
- **Transcription**: OpenAI `gpt-4o-mini-transcribe`
- **Document conversion**: Microsoft MarkItDown (Python CLI via child_process)
- **Audio extraction**: yt-dlp + FFmpeg
- **Deployment**: Render (with Docker support)

## Project Structure
```
├── server.js                    # Express entry point
├── api/
│   ├── transcribeVideo.js       # URL-based transcription endpoint
│   ├── transcribeUpload.js      # File upload transcription endpoint
│   ├── transcribeAudio.js       # Whisper/gpt-4o-mini-transcribe API call
│   ├── extractAudio.js          # yt-dlp audio extraction
│   ├── convertDocument.js       # Document-to-Markdown conversion (MarkItDown)
│   ├── secrets.js               # Secretos: create/list/reveal/delete handlers
│   ├── auth.js                  # JWT + bcrypt + magic link helpers
│   ├── services/
│   │   ├── llmService.js        # LLM provider router (Anthropic/OpenAI)
│   │   ├── anthropicService.js  # Claude API integration
│   │   ├── openaiService.js     # OpenAI chat integration
│   │   ├── cryptoService.js     # AES-256-GCM encrypt/decrypt for Secretos
│   │   ├── emailService.js      # Resend wrapper for magic link emails
│   │   ├── logService.js        # API logging
│   │   └── transcriptionService.js
│   ├── reels/                   # AS Reels Cleaner: cuts + crop 9:16 + subs + música
│   │   ├── silenceDetector.js   # Gaps desde Whisper words → keep segments + remap
│   │   ├── reelRenderer.js      # ffmpeg renderReelBase + burnSubsOnBase + probeDuration
│   │   ├── reelSubtitles.js     # Build ASS + chunks editables (reusa chunkWordsForClip)
│   │   ├── reelsService.js      # Orquestador máquina de estados + suggestMusic (LLM)
│   │   ├── routes.js            # Endpoints HTTP de jobs (CRUD + style + music + finalize)
│   │   ├── musicTags.js         # Catálogo mood/energía/género (50+ tags)
│   │   ├── musicService.js      # CRUD tracks (local + remote stub)
│   │   ├── musicMixer.js        # ffmpeg mix con sidechaincompress (auto-ducking)
│   │   ├── musicRoutes.js       # CRUD HTTP del catálogo + stream + curate
│   │   ├── jamendoService.js    # Cliente Jamendo API (instrumentales CC)
│   │   └── curateService.js     # Plan de recetas + ensureLocalFile (lazy download)
│   ├── controllers/             # Script, client, document, log controllers
│   ├── routes/                  # Express routes (clients, scripts, logs)
│   ├── database/
│   │   └── schema.js            # SQLite schema (users, transcriptions, conversions, usage_stats, settings, secrets, magic_link_tokens)
│   ├── rag/                     # RAG document processor (TF-IDF with natural)
│   └── utils/                   # Platform detector, usage tracker
├── src/
│   ├── App.jsx                  # React Router (/, /transcribir, /convertir, /clips, /reels-cleaner, /secretos, /secreto/:token, /magic/:token, /mis-resultados, /admin)
│   ├── pages/                   # ToolHub, Home, ConvertPage, SecretsPage, ViewSecretPage, MagicLinkPage, MyResults, AdminPanel, LoginPage, NotFound
│   ├── components/              # TranscriptionForm, ConvertForm, Header, Footer, etc.
│   ├── context/                 # AuthContext, TranscriptionContext, ConversionContext
│   ├── services/                # API client, usageStats service
│   └── hooks/                   # useLocalStorage, useTranscription
└── data/                        # SQLite database (gitignored)
```

## Key Commands
```bash
npm run dev            # Start frontend + backend concurrently
npm run dev:frontend   # Vite dev server only
npm run dev:backend    # Express with nodemon only
npm run build          # Production build (Vite)
npm start              # Production server
npm run migrate        # Migrate JSON data to SQLite
npm test               # Vitest one-shot (cubre lógica de cortes de Reels Cleaner)
npm run test:watch     # Vitest modo watch
npm run seed:test      # Siembra usuarios de prueba deterministas (solo dev)
npm run test:token <email>  # JWT de sesión para login sin teclear contraseña
```

## Testing / QA — ver `docs/TESTING.md`
Método de pruebas reproducible, **usuarios de prueba siempre listos** y regla de qué
navegador usar. Lo esencial:
- `npm run seed:test` crea 3 fixtures (contraseña `Prueba1234`, solo dev, aborta en prod):
  `test.owner@` (owner), `test.cliente@` (member activo), `test.expirado@` (acceso vencido).
- **Login para automatización sin teclear contraseña**: `npm run test:token <email>` →
  pegar el snippet `localStorage.setItem('token',…);location.reload()` en la consola del
  navegador. El token lo firma el backend, así siempre valida.
- **Navegador**: para QA de esta app (localhost, sin cuentas externas) usar el navegador
  **automatizado** (Browser pane / `agent-browser` CLI), que no toca el Chrome personal.
  Reservar **Claude in Chrome** para tareas con sesión real de Julián (dashboard de Render,
  prod tras SSO, etc.). Ante la duda, preguntar.
- **Bucle de verificación**: levantar `npm run dev` → `seed:test` → `test:token` → conducir
  el flujo con el navegador → revisar consola/network → screenshot claro+oscuro. Nunca pedir
  "revisa tú": verificar y mostrar la prueba. Detalle completo en `docs/TESTING.md`.

## Environment Variables
Required in `.env`:
- `OPENAI_API_KEY` — For transcription (gpt-4o-mini-transcribe) and script generation fallback
- `ANTHROPIC_API_KEY` — For script generation (primary)
- `JWT_SECRET` — Secret for JWT token signing
- `SECRETS_ENCRYPTION_KEY` — 64-char hex (32 bytes) for AES-256-GCM. `start.sh` autogenerates if missing.
- `RESEND_API_KEY` — Resend key for magic link emails. Without it, links go to server console (dev fallback).
- `MAGIC_LINK_FROM_EMAIL` — Sender address (must be on a verified domain in Resend; `onboarding@resend.dev` for dev).
- `APP_BASE_URL` — Public URL where the app lives. Used to build magic link URLs. In dev set to `http://localhost:5173`.
- `JAMENDO_CLIENT_ID` — Para AS Reels Cleaner: poblar catálogo de música con tracks Creative Commons de Jamendo. Registro gratis en devportal.jamendo.com (sin tarjeta). Sin esto, el botón "Ampliar catálogo" muestra error.
- `LLM_PROVIDER` — Force `anthropic` or `openai` (auto-detects by default)
- `PORT` — Server port (default 3000)
- `FFMPEG_PATH` — Custom ffmpeg path (optional)
- `MARKITDOWN_PATH` — Custom markitdown path (optional)

## External Dependencies
- `yt-dlp` — Video download (called via child_process)
- `ffmpeg` — Audio extraction (called via child_process)
- `markitdown` — Document conversion (Python CLI, installed via `pipx install 'markitdown[all]'`)

## Conventions
- Language: Spanish for UI text and comments, English for code identifiers. Español **neutro** (tú/tienes) — nada de voseo en UI, copy, prompts ni docs.
- ESM modules throughout (`"type": "module"` in package.json)
- API routes prefixed with `/api/`
- Frontend uses React functional components + hooks
- **Estilo visual: sistema "Sala de edición" — `docs/DESIGN.md` es la ley.** Dark-first, tokens `ink/paper/accent/ok/warn/danger` y primitivas `.btn/.card/.input/.chip/.eyebrow/.timecode`. No inventar colores/gradientes ni escribir classNames sueltos de `gray-*`/`purple-*`. Ver regla obligatoria abajo.
- SQLite for all persistence (no external DB needed)
- Each tool has its own Context, Form, Results, and Saved components
- ToolHub (`/`) serves as the home dashboard; each tool gets its own route

## Architecture Pattern for Adding New Tools
1. Backend: new handler in `api/`, new functions in `usageTrackerSQLite.js`, new routes in `server.js`
2. DB: new table in `schema.js`
3. Frontend: new Context, Form, Results, SavedX components
4. New page in `src/pages/`, new route in `App.jsx`
5. Add card to `ToolHub.jsx`, link in `Header.jsx` and `Footer.jsx`
6. Add tab in `MyResults.jsx`, section in `AdminPanel.jsx`
7. **Diseño**: toda pantalla/componente nuevo se construye con las primitivas de `docs/DESIGN.md` (ver regla obligatoria abajo). Nada de estilos ad-hoc.
8. **MCP**: ver regla obligatoria abajo. Considerar exponer la funcionalidad vía MCP en `api/mcp/tools/` siguiendo la receta de `docs/MCP.md` sección 4.

## Sistema de diseño — "Sala de edición" (rebrand 2026)
La app viste la marca real de algosentido.com: **dark-first** (vive en oscuro como una suite de
edición), tinta cálida y el azul de marca como único acento. Wordmark **AlgoSentido · Estudio**.
Se vende a clientes del estudio, así que la UI es cara al cliente y debe verse premium y consistente.

**Documentación viva**: `docs/DESIGN.md` cubre tokens, primitivas, patrones de página, mapeos
antes→después y la lista de intocables. **Léelo antes de tocar cualquier `.jsx` de `src/` o
`src/index.css`/`tailwind.config.js`.**

**Piezas del sistema** (reusar, no reinventar):
- Tokens de color: `ink-*` (neutros tinta), `paper`, `accent{,-bright,-soft,-deep}`, y semánticos
  `ok/warn/danger` — todos con par claro/oscuro. Definidos en `tailwind.config.js`.
- Primitivas CSS (`src/index.css`, `@layer components`): `.btn` (+`btn-primary/accent/ghost/danger/sm`),
  `.input`, `.form-label`, `.card`, `.chip` (+variantes), `.eyebrow`, `.timecode`, `.link-accent`.
- Componentes: `Wordmark.jsx` (único logo), `ui/feedback.jsx` → `useToast()` y `useConfirm()`
  (reemplazan `alert()`/`confirm()` nativos — está **prohibido** volver a usar los nativos).
- Tipografía: `font-sans` (Inter) cuerpo · `font-display` (Archivo) titulares · `font-mono` tabular
  para timecodes/costos/contadores.

### Regla obligatoria — todo cambio de frontend sale del sistema
Cualquier sesión que cree o modifique UI (`src/**/*.jsx`, estilos) **debe** construir con los tokens
y primitivas de `docs/DESIGN.md`. El default mental es "¿esto ya existe como primitiva?" — crear un
botón/card/modal/estilo a mano es la excepción y hay que justificarla.

Aplica a:
- ✅ Pantallas y componentes nuevos → primitivas del sistema desde el inicio
- ✅ Ediciones a UI existente → si tocas un bloque, déjalo en tokens (no perpetúes `gray-*`/`purple-*`)
- ✅ Feedback al usuario → `useToast`/`useConfirm`, nunca `alert`/`confirm`/`prompt` nativos
- ❌ NO aplica al render de subtítulos/captions ni a las paletas ofrecidas como opción (son **contenido**
  del video del usuario, no UI — lista de intocables en `docs/DESIGN.md`)

**Definition of done de cualquier UI**: (1) cero `purple/indigo/violet/fuchsia` y cero gradientes de
marca; (2) `gray-*` solo si es deliberado (raro); (3) revisado en claro **y** oscuro; (4) superficies de
video en `bg-ink-950` en ambos temas; (5) `npm test` verde. Si agregas algo al sistema (una primitiva
nueva, p. ej. el `promptDialog` pendiente), documéntalo en `docs/DESIGN.md` en el mismo commit.

## MCP Server (Model Context Protocol)
AS Tools tiene un **servidor MCP remoto** en `https://as-tools.algosentido.com/mcp` que expone funcionalidades del backend a clientes de IA como Claude.ai vía OAuth 2.1. Permite que los clientes finales usen AS Tools directamente desde su chat de Claude (transcribir, analizar ideas, etc).

**Archivos clave**: `api/mcp/` (server, tools, audit, admin) y `api/oauth/` (OAuth 2.1 flow completo).
**Tab admin**: `/admin → 🔌 MCP` para monitoreo, cuotas, audit log, toggle de emergencia.

**Documentación viva**: `docs/MCP.md` cubre arquitectura, flujo OAuth, receta para agregar tools, operación en prod, decisiones de diseño, y roadmap. **Léelo antes de tocar `api/mcp/*` o `api/oauth/*`.**

### Regla obligatoria — considerar MCP en todo cambio de backend
Toda sesión que toque endpoints REST en `server.js` o services en `api/services/` debe **proponer explícitamente** la implementación MCP de ese cambio como parte del plan. El default mental es "¿esto también debería estar disponible vía MCP?" — no preguntar es la excepción, no la regla.

Aplica a:
- ✅ Endpoints REST nuevos
- ✅ Cambios en services del backend (lógica que tools podrían reusar)
- ✅ Cambios en responses que afectan estructura de datos
- ❌ NO aplica a fixes triviales de UI o estilo
- ❌ NO aplica a refactors internos sin cambio funcional

Si la respuesta es "no exponer en MCP", justificar brevemente. Si es "sí", incluirlo en el plan desde el inicio (no como afterthought). La receta para agregar una tool MCP está en `docs/MCP.md` sección 4 — son ~30 líneas de código si la lógica ya existe en un service.

### Mantener docs + tests en sync
Si tu cambio toca `api/mcp/*`, `api/oauth/*`, `api/services/*`, o agrega columnas en `schema.js`:

**Docs** (en el mismo commit):
- Actualiza `docs/MCP.md` si cambió arquitectura/endpoints/tools
- Agrega entrada en `docs/CHANGELOG.md` (una línea, descriptiva)

**Tests** (en el mismo commit cuando aplique):
- Si la lógica nueva es testeable de forma aislada (pura o con mock simple) → agrega/extiende `.test.js` siguiendo el patrón existente
- Antes de commitear: `npm test` (debe pasar todo, <1s) y `npm run smoke:mcp` (si el dev backend está arriba)
- Después del deploy a Render: `BASE=https://as-tools.algosentido.com EMAIL=… PASS=… npm run smoke:mcp` para confirmar prod

El hook Stop en `.claude/settings.json` (`mcp-checks.sh`) te recuerda los pendientes de docs y tests al final de cada sesión, y siempre te recuerda correr los tests + smoke antes de commitear. No bloquea — solo avisa.

## Portable Claude Setup
This project keeps all Claude Code config in git for portability across machines:
- `CLAUDE.md` — Project context (this file)
- `.claude/settings.json` — Permissions and hooks (the PostToolUse hook is portable: derives the local Claude memory path from `git rev-parse --show-toplevel`, no hardcoded user dir)
- `.claude/memory/` — Claude memories (synced via hook on every Write/Edit)
- `.claude/sync-memories.sh` — Manual sync script (`pull` from repo to local, `push` from local to repo)

**On a new machine after cloning:**
```bash
.claude/sync-memories.sh pull
pipx install 'markitdown[all]'  # Requires Python 3.10+
```
This copies memories from the repo to your local Claude config.

**The PostToolUse hook** in `.claude/settings.json` automatically syncs memories from local Claude to the repo on every file write/edit, so they stay updated for the next commit.
