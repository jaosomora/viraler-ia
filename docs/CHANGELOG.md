# Changelog

Cambios relevantes del proyecto AS Tools. Una línea por commit que afecte funcionalidad,
ordenado por fecha descendente. Para detalles del MCP server ver `docs/MCP.md`.

> Convención: cada commit que toque `api/mcp/*`, `api/oauth/*`, o que cambie endpoints/services
> del backend, debe agregar entrada aquí. El hook PostToolUse lo recordará.

---

## 2026-07-14 — Fix: dev respeta JWT_SECRET del .env

`server.js` cargaba `.env` (`dotenv.config()`) después de los imports, así que `api/auth.js`
capturaba el secreto de fallback hardcodeado en dev y el `JWT_SECRET` del `.env` se ignoraba.
Movida la carga a `import 'dotenv/config'` como primer import → dev firma/valida con el mismo
secreto que producción. Verificado: token firmado con el `.env` ahora valida contra `/api/auth/me`
(antes 401 → ahora 200). Prod no se afectaba (Render inyecta la env var antes del proceso).
- MCP: no aplica.

## 2026-07-14 — Método de pruebas reproducible + usuarios de prueba

Infraestructura de QA para que cualquier sesión reproduzca bugs o valide flujos sin adivinar
credenciales ni tocar cuentas reales. Todo dev-only (aborta en prod). Doc: `docs/TESTING.md`.

- `scripts/seed-test-users.js` (`npm run seed:test`): 3 fixtures deterministas idempotentes —
  `test.owner@` (owner), `test.cliente@` (member activo), `test.expirado@` (acceso vencido a
  propósito). Contraseña común `Prueba1234`. Aborta si `NODE_ENV=production`.
- `scripts/test-token.js` (`npm run test:token <email>`): obtiene el JWT vía login del backend
  e imprime el snippet de `localStorage` para login sin teclear contraseña. Como lo firma el
  backend, siempre valida (evita el gotcha de que en dev el JWT_SECRET del `.env` se ignora
  por orden de carga de dotenv en `server.js` — documentado).
- `docs/TESTING.md`: entorno local (split 3000/5173), tabla de usuarios, login por token vs
  formulario, bucle de verificación, y regla de navegador (automatizado para QA localhost vs
  Claude in Chrome para sesiones reales).
- `CLAUDE.md`: sección Testing/QA + comandos en Key Commands.
- MCP: no aplica (tooling de dev).

## 2026-07-13 — Rebranding visual completo: sistema "Sala de edición"

Rebrand de toda la capa visual del frontend para alinear la app con la marca real de
algosentido.com y poder venderla a clientes del estudio. Solo UI — cero cambios de lógica,
endpoints o pipeline de render. Dirección aprobada: dark-first ("la app vive en oscuro como
una suite de edición"), tinta cálida + azul de marca como única luz de señal.

- **Sistema de diseño nuevo** documentado en `docs/DESIGN.md`: tokens `ink/paper/accent/ok/warn/danger`
  en `tailwind.config.js`, primitivas CSS (`.btn` pills, `.card`, `.input`, `.chip`, `.eyebrow`,
  `.timecode`) en `src/index.css`. Tipografía: Inter (cuerpo) + Archivo (display, ya self-hosteada)
  + mono tabular para timecodes/costos.
- **Identidad**: wordmark `AlgoSentido · Estudio` (componente `Wordmark.jsx`, "Sentido" en azul),
  favicon SVG real (flecha azul sobre tinta — el anterior tenía 0 bytes), título "Algo Sentido · Estudio".
- **Dark-first sin parpadeo**: script anti-FOUC en `index.html`; oscuro por defecto, claro opt-in;
  toggle también en el login.
- **Feedback de la casa**: `src/components/ui/feedback.jsx` (FeedbackProvider + `useToast` +
  `useConfirm`) reemplaza todos los `alert()`/`confirm()` nativos del navegador.
- **Todas las páginas y componentes** migrados al sistema: hub, login, transcribir, convertir,
  clips (incl. editor), reels cleaner, ideas, secretos, resultados, admin, 404. Fuera los 6
  gradientes por herramienta y el morado Tailwind genérico. Las superficies de video quedan
  siempre en oscuro (se edita video sobre oscuro), en ambos temas.
- **Intocado**: overlay WYSIWYG de captions, `captionTemplates.js`, `FONT_CATALOG`, `@font-face`
  block, y todo el backend. Paletas de subtítulos = contenido del usuario, no UI.
- MCP: no aplica (cambio 100% visual de frontend).

## 2026-05-20 — Reels Cleaner: conexión visible entre etiquetas y curación de catálogo

Bug de UX: cuando el usuario marca tags en el TagsPicker, esas etiquetas filtran la lista local Y también determinan qué se descarga al pulsar "+ Ampliar catálogo". La conexión solo estaba dicha en una línea de helper text que casi nadie leía. Y la sugerencia IA tampoco se veía si había tags activos.

- `MusicReviewView`: el card "Ampliar catálogo" cambia a estado verde con ring + chips listando las etiquetas activas cuando hay alguna marcada. El título y CTA del card se actualizan ("Traer canciones de estos estilos a tu biblioteca" + "+ Traer de estos estilos").
- `MusicReviewView`: aviso inline debajo del `TagsPicker` que explica la doble función. Cambia según el estado (sin tags marcados explica que marcar etiquetas filtra Y refina; con tags marcados confirma cuántas hay activas y señala con flecha hacia arriba el botón de curación).
- `handleSuggest`: al pulsar "Sugerir música" se limpian los filtros activos automáticamente para que las 3 sugerencias de la IA siempre sean visibles (antes quedaban escondidas si la IA elegía tracks fuera del filtro).
- MCP: no aplica.

## 2026-05-20 — Refactor de UX en Clips y Reels Cleaner

Pasada amplia de mejoras de UX a las dos herramientas principales, unificando patrones de jerarquía visual y reescribiendo copy para que un cliente nuevo pueda usarlas sin contexto previo y sin ver información técnica del owner. Detalle completo en el commit `653f490`.

- Clips editor: 6 secciones reordenadas (Plantillas → Lienzo → Subtítulos → Texto → Estilo → Movimiento), modo acordeón (una sección abierta a la vez), sub-bloques con previsualización `Aa` en tiempo real, Playfair Display agregada a los dropdowns de Hook y Caption.
- Clips landing: form headers en sentence case, "Jobs anteriores" → "Historial", todos los precios eliminados de la UI del cliente.
- Reels Cleaner: header consistente entre los 3 pasos (minimal + duración a la derecha, CTAs al pie del preview); "job" → "reel"/"video" globalmente (28 strings); botones con pulse amber cuando hay cambios sin previsualizar; Paso 1 con trim "play + click" en lugar de inputs mm:ss; Paso 2 reorganizado en sub-bloques (Texto / Borde / Posición) con orden Subtítulos → Estilo → Voz; Paso 3 con mensajes user-friendly y sin jerga técnica.
- API: `routes.js` y `reelsService.js` con mensajes de error reescritos ("Job no encontrado" → "Reel no encontrado", 28 ocurrencias).
- MCP: no aplica.

## 2026-05-20 — Fix: mayúsculas mid-sentence en español + prompt cleanup reforzado

El cleanup ortográfico operaba a nivel de segments y dejaba palabras capitalizadas a mitad de frase en el array `words` ("él No es", "más Porque sabes", "conoces Tu rutina"). Visible especialmente en Reels Cleaner donde los chunks se ven en lista separada.

- `api/clips/orthographyCleanup.js`: prompt reforzado con regla crítica y ejemplos correctos/incorrectos sobre continuación de líneas en minúscula. Lista de palabras-trampa que GPT debe vigilar.
- `api/clips/captionsService.js`: post-procesado en `chunkWordsForClip` que baja a minúscula palabras de una stop-list curada (~80 conjunciones, pronombres, preposiciones, adverbios, verbos cópula en español) cuando aparecen capitalizadas mid-flow. Defensive layer si GPT no sigue el prompt.
- Beneficio compartido: aplica a Clips y a Reels Cleaner sin re-procesar nada (los chunks se reconstruyen en cada carga del job).
- MCP: no aplica.

## 2026-05-20 — Clips: preview en vivo del encuadre mientras arrastrás el slider

Antes el slider solo mostraba el `%` numérico mientras arrastrabas — había que soltar y esperar el regen de ffmpeg (~7s) para ver el resultado. Ahora hay preview WYSIWYG instantáneo.

- Nuevo endpoint `GET /api/clips/:id/source-thumbnail` que extrae un frame JPG (640×360) del source video al midpoint del clip. Cacheado en disco (`<clipId>_source_thumb.jpg`), 1 día de browser cache.
- `ClipEditor.jsx`: prefetch del thumbnail al abrir el editor (vía Bearer token → blob URL). Mientras `cropPreviewActive=true` (entre `onMouseDown`/`onTouchStart`/`onFocus` y el correspondiente release), se monta un `<img>` overlay sobre el VideoPreview con `object-fit: cover; object-position: ${slider}% center`. El usuario ve EXACTAMENTE qué porción del source va a quedar antes de soltar.
- Al soltar: overlay desaparece + commit a `draft.crop_x_pct` → regen del base.mp4 con el valor final.
- MCP: no aplica — endpoint dedicado al editor UI.

## 2026-05-20 — Clips: slider de encuadre solo persiste al soltar (evita 502s en prod)

Tras desplegar el fix del encuadre, el slider de "Ajuste fino" disparaba un PATCH+regen ffmpeg en CADA micro-movimiento. Mover el slider de 0 a 50 generaba decenas de renders encolados → gateway de Render devolvía 502.

- `ClipEditor.jsx`: state local `cropSliderValue` cambia en vivo mientras arrastrás (feedback visual), pero `draft.crop_x_pct` (que dispara el regen) solo se actualiza al soltar — `onMouseUp` / `onTouchEnd` / `onKeyUp`. Los presets Izq/Centro/Der siguen siendo instantáneos.
- Validado en local: drag de 8 valores → 0 requests al backend. Release → exactamente 1 regen con el valor final.

## 2026-05-20 — Clips: fix crítico del encuadre horizontal (hash truncado + race condition)

Tras desplegar `crop_x_pct` el día anterior, los presets Izq/Centro/Der no cambiaban el video. Diagnóstico completo con browser automation contra el dev local reveló 3 bugs:

- **Hash truncado**: `baseParamsHash()` hacía `Buffer.from(h).toString('base64').slice(0,16)` lo cual solo cubría ~12 chars del string crudo. Resultado: `start_seconds + end_seconds` ocupaban todo el espacio y cambios en `crop_x_pct` / `transition` / `camera_motion` / `resolution` jamás afectaban el output → `ensureClipBase` siempre veía "match" y nunca regeneraba. Fix: `crypto.createHash('md5').digest('hex')` (32 hex chars, sin truncar).
- **Race condition por StrictMode**: React dev hace double-mount → dos fetches simultáneos a `/base-video` → dos `renderClipBase` escribiendo al mismo path → mp4 corrupto con NAL units inválidos. Fix: `_baseRenderLocks` Map en `ensureClipBase` (clipId+resolution) — segundo request espera la promise del primero.
- **`mode='base'` se pasaba solo en el editor, no en ClipCard**: la card del listado usa default `mode='final'` → `/download` (subs quemados). El editor sí usa `/base-video` (sin subs, overlay editable). Confirmado correcto, era falsa alarma durante el debug.

Tests: 292/292 ✅. Validado en local con video de dos personas: crop_x_pct=0 enfoca a la persona izquierda, =100 a la derecha, =50 mantiene el centro histórico.

## 2026-05-19 — Clips: encuadre horizontal seleccionable (Izq/Centro/Der + ajuste fino)

Para fuentes con dos personas lado a lado (entrevistas Zoom), el crop 9:16 centrado caía en el espacio entre ambas. Ahora cada clip tiene `crop_x_pct` (0=izq · 50=centro/default · 100=der).

- `schema.js`: nueva columna `crop_x_pct INTEGER DEFAULT 50` en `clips` (migration idempotente).
- `videoProcessor.js`: nueva función pura exportada `buildCropExpr(aspect, cropXPct)` usada por `renderClipBase` y `renderClip`. Incluida en `baseParamsHash` para forzar re-render del base al cambiar el encuadre.
- `clipsService.js#updateClip`: whitelistea `crop_x_pct` y lo clampea a 0-100.
- `routes.js#applyStyleToAllHandler`: permite propagar el encuadre a todos los clips del job.
- `ClipEditor.jsx`: nueva sub-sección "Encuadre horizontal" dentro de "Movimiento y transiciones" con 3 presets + slider. Auto-persiste y regenera el base al cambiar.
- Backwards-compatible: clips antiguos sin valor usan 50% (= comportamiento histórico de `crop=ih*9/16:ih` centrado).
- Tests: 8 tests nuevos en `videoProcessor.test.js` cubren la expresión generada por aspect, valores fuera de rango y defaults.

## 2026-05-19 — Retry per-chunk en uploads para sobrevivir blips de red

Tras desplegar el chunked upload, un solo chunk fallando (network blip) mataba el upload completo. Para 562MB / 113 chunks sobre conexión hogareña, casi imposible llegar al 100% al primer intento.

- `chunkedUpload.js`: `postChunk` ahora reintenta hasta 4 veces con backoff exponencial (1s, 3s, 9s). Diferencia entre errores retryable (5xx, 408, 429, network/abort) y no-retryable (4xx específicos). Sin esto, cada parpadeo = restart desde cero.
- Error final al usuario incluye el conteo de intentos: `chunk N: HTTP 502 (después de 4 intentos)`.

## 2026-05-19 — Hotfix: peak de disco al subir bajado de 3x a 1x file size

Tras desplegar el upload chunked, una subida de 562MB se cortó al 95% con `ENOSPC: no space left on device`. El disco persistente en Render starter es **1GB** y mi pipeline gastaba ~3x el tamaño del archivo: chunks (562MB) + final.mp4 reensamblado (562MB) + copia a jobDir (562MB) = ~1.7GB. Imposible.

Cambios:
- `uploads/service.js`: `finalizeUpload` ahora streamea cada chunk al final.<ext> con unlink-as-we-go (cada chunk se borra apenas se copió). Peak en finalize: 1x.
- `clips/clipsService.js` y `reels/reelsService.js`: `fs.renameSync` (mv atómico) en vez de `copyFileSync` cuando se mueve el archivo del upload al jobDir. Fallback a copy si el rename falla (cross-filesystem). Peak total: ~1x file size.
- Server boot: `purgeStaleUploads(1h)` se ejecuta al startup, recuperando disco de subidas que se cortaron en deploys anteriores.
- `/api/uploads/init`: cada vez que un usuario inicia un upload, corre purge defensivo de uploads huérfanos >1h. Mantiene el disco bajo control sin esperar al cron horario.

**Nota operacional**: 1GB de disco persistente sigue siendo apretado para video. Considerar subir a 5–10GB en Render dashboard si vamos a tener más de 1-2 jobs simultáneos.

## 2026-05-19 — Upload chunked (Clips + Reels) para sortear timeout de Render

Render mata las requests HTTP a ~100s. Un upload single-shot de 590MB sobre conexión hogareña típica tardaba ~5 min y el proxy cortaba la conexión a la mitad (`Error: Request aborted` en multer). La barra de progreso que agregamos justo antes confirmó el patrón.

**Solución**: nuevo módulo genérico `api/uploads/{service,routes}.js` que recibe el archivo en chunks de 5MB. Cada chunk es un POST chico que cabe sobradamente en cualquier timeout. El backend concatena al finalizar.

- 3 endpoints nuevos: `POST /api/uploads/init` (devuelve uploadId), `POST /api/uploads/chunk` (multipart, max 10MB), `POST /api/uploads/finalize` (concatena).
- Storage en `/opt/data/uploads-tmp/<uploadId>/`. Cron de cleanup ya existente cubre huérfanos (TTL 24h).
- `POST /api/clips/generate` y `POST /api/reels/upload` ahora aceptan `{uploadId}` además de los flujos previos (clips quedó JSON-only; reels mantiene compat con multipart legacy).
- Frontend: nuevo helper `src/services/chunkedUpload.js` que parte el archivo y reporta progreso. `ClipsContext.generate()` y `reelsApi.uploadReel()` lo usan automáticamente.
- 10 tests unitarios cubren validaciones, auth cross-user, orden de chunks, idempotencia de finalize y TTL.
- **No es resumable en v1**: si un chunk falla, el usuario reintenta el upload completo; los chunks ya subidos quedan en disco y son re-sobrescritos. Cron limpia huérfanos a las 24h.

Para "direct-to-storage" con R2/S3 + presigned URLs (que bypasea Render por completo) ver roadmap — esto cubre hasta que tengamos volumen alto de clientes.

## 2026-05-19 — UI de Clips ahora muestra el error_message al usuario

Dos bugs en el frontend de Clips hacían que los errores quedaran invisibles aunque el backend los guardara:
- `ClipsPage.jsx` filtraba jobs con status='error' fuera de la lista "en progreso", entonces `JobProgress` (que sí renderiza el error en rojo) nunca aparecía tras un fallo. Ahora los jobs en error se quedan en la lista hasta que el usuario los descarta con el botón eliminar.
- `SavedClips.jsx` mostraba el badge "error" pero no el `error_message` debajo. Ahora se renderiza en rojo como ya hace Reels (`SavedReels.jsx:79`).

Combinado con el cambio anterior de `describeFfmpegError()`, el usuario ahora ve el mensaje accionable completo en la UI sin tener que mirar logs.

## 2026-05-19 — Mensajes de error claros cuando ffmpeg rechaza el video

Cuando el archivo subido está corrupto (típicamente `.mov` con grabación cortada antes de cerrarse → falta el `moov atom`), Clips/Reels/Transcribir mostraban el stderr crudo de ffmpeg al usuario, que era incomprensible. Ahora `describeFfmpegError()` en `videoProcessor.js` detecta los 3 patrones más comunes (moov faltante, data inválida, archivo no encontrado) y devuelve un mensaje en español con qué hacer al respecto (reexportar, usar untrunc, etc). Si no reconoce el patrón cae al stderr crudo como fallback. Test cubre los 4 casos.

## 2026-05-19 — Fix: uploads de video truncados en prod ("moov atom not found")

Multer escribía a `os.tmpdir()` (= `/tmp`, tmpfs/RAM en el contenedor de Render). Videos grandes (Clips/Reels/transcribeUpload) llenaban tmpfs y se truncaban silenciosamente; el `moov` atom al final del MP4 se perdía y ffmpeg fallaba con `moov atom not found` al extraer audio. Síntoma reportado: `copied uploaded file (0.1s)` — copia instantánea = archivo truncado.

- **server.js**: nuevo `UPLOADS_TMP` = `/opt/data/uploads-tmp` en prod (disco persistente), `os.tmpdir()` en dev. Aplicado a los 3 multer de video: transcribeUpload, clips, reels. Convert/music siguen en tmpdir (archivos chicos).
- **clipsService.js / reelsService.js**: tras copiar el upload, se borra el tmp file (antes en tmpdir era efímero, ahora hay que limpiar). Clips además loguea el tamaño real en MB para diagnosticar futuros casos.
- **No toca MCP**: los uploads son solo del frontend web; no hay tool MCP equivalente que reciba archivos binarios.

## 2026-05-17 — Rename: analyze_ideas → analyze_video_transcript

Claude.ai elegía consistentemente `analyze_ideas` cuando el usuario pedía "Generador de Ideas" porque ambos nombres contenían "ideas". Tres iteraciones de description tweaks no resolvieron el colapso de routing. Solución estructural: renombrar la tool MCP para que solo `build_idea_map` contenga "idea" en el nombre.

- **MCP**: `analyze_ideas` → `analyze_video_transcript`. La lógica, el lente, el costo ($0 server-side), todo igual. Solo cambia el nombre que ve el cliente MCP.
- **UI web**: el botón "Analizar ideas" en `VideoAnalysisPanel` se queda como está — afecta solo MCP.
- Audit log filter, smoke test, comentarios de services y docs actualizados.
- **Acción requerida**: los clientes MCP que tengan el nombre viejo cacheado deben desconectar + reconectar para refrescar `tools/list`.

## 2026-05-17 — Generador de Ideas (build_idea_map)

Nueva herramienta `/mapa-de-ideas` + tool MCP `build_idea_map` (scope nuevo `ideas:write`). Mapa de contraste → la compuerta extrae territorios y bloquea con repregunta si el insumo está roto (Fallo 1 sentimiento-vs-escena, Fallo 2 eje único disfrazado, Fallo 3 fuga). Solo si pasa los tres filtros genera 4-5 frases crudas cruzando subtemas de territorios o caras distintas. Límites duros: 2 repreguntas por filtro, 5 turnos totales.

- **Patrón dual web/MCP** (clonado de `analyze_ideas`): web ejecuta gpt-4o-mini en backend (`api/services/ideaMapService.js` con 3 prompts: gate + fuga + generate); MCP devuelve el LENS sin ejecutar nada y Claude-en-chat aplica. Costo MCP = $0.
- **Backend**: `api/services/ideaMapService.js` (LENS canónico + prompts + runGate/runGenerate + límites), `api/utils/ideaMapsTracker.js` (CRUD), `api/ideaMaps.js` (handlers REST con máquina de estados multi-turno), tabla `idea_maps` + columnas `idea_maps`/`idea_maps_cost` en `usage_stats`.
- **Endpoints**: `POST /api/idea-maps` (arranca + procesa primer turno), `POST /api/idea-maps/:id/respond` (turnos siguientes), `GET/DELETE /api/idea-maps[/:id]`, `GET /api/admin/idea-maps`.
- **MCP tool**: `api/mcp/tools/buildIdeaMap.js`. Stateless: el cliente Claude pasa `prior_attempts` en cada call. La tool calcula límites y devuelve la estructura para que Claude razone.
- **OAuth**: nuevo scope `ideas:write` agregado en `metadata.js`, `views.js` (consent), `authorize.js`.
- **Frontend**: `IdeaMapPage` (formulario inicial + turnos + resultado), `SavedIdeaMaps` (lista en MyResults), `IdeaMapsAdmin` (tab admin con totales y tabla por usuario). Cards en ToolHub, links en Header/Footer.
- **Tests**: `api/services/ideaMapService.test.js` con 10 casos (6 compuerta, 3 generación, 1 edge). Mockean `globalThis.fetch`. 74 tests totales pasan.

## 2026-05-17 — Sprint MCP inicial

### Tests (Tier 1 + 2)
- **`scripts/smoke-mcp.sh`** — smoke test end-to-end del MCP: discovery → DCR → login → consent → token → initialize → tools/list → tool/call. Configurable via `BASE`, `EMAIL`, `PASS`. Corre con `npm run smoke:mcp`.
- **Unit tests críticos del OAuth + audit**:
  - `api/oauth/session.test.js` — HMAC de cookies de sesión (round-trip, tampering, expiración, rotación de secret)
  - `api/oauth/token.test.js` — PKCE S256 (válido, inválido, longitudes límite, padding)
  - `api/mcp/audit.test.js` — `checkQuota` (owner unlimited, sin cuota, en/sobre límite) + `isQuotaApplicable`
- `verifyPkceS256` exportada desde `api/oauth/token.js` para testabilidad.
- Total: ~40 tests del MCP corren en <1s. Existentes de Reels intactos.

### Documentación
- **docs/MCP.md** — doc maestro del MCP server (arquitectura, OAuth, receta para agregar tools, operación, roadmap)
- **docs/CHANGELOG.md** — este archivo, arrancando con el sprint MCP
- **CLAUDE.md root** — sección MCP + regla estricta "considerar MCP en todo cambio de backend"
- **`.claude/settings.json`** — hook PostToolUse que recuerda actualizar docs si se tocó código MCP

### Admin panel
- **Nuevo tab `🔌 MCP` en /admin** (`c523349`) — overview, clientes registrados, sesiones activas (revocables), cuotas por usuario, audit log con filtros, toggle global de emergencia
- Backend: 9 endpoints REST `/api/admin/mcp/*` (ownerOnly): overview, clients, tokens, audit, settings, quotas
- Nueva tabla `mcp_audit_log` (cada tool call queda registrado con duración, costo, success/error)
- Nuevas columnas en `users`: `mcp_quota_transcriptions_per_day` (NULL = ilimitado), `mcp_disabled`
- Wrapper en `api/mcp/server.js` instrumenta cada handler con audit + quota check
- Toggle global en tabla `settings` (`mcp_disabled`) para apagar `/mcp` con 503 sin tocar la UI web

### Fixes
- **`3030a6a`** UI: `VideoMetadataCard` ahora muestra el handle real cuando `uploader_handle` de TikTok es id numérico (preferencia: uploader_handle no-numérico → handle parseado de `/@xxx/` en uploaderUrl → channel). Mismo criterio que el helper del MCP.
- **`256d11a`** MCP: `analyze_ideas` ya no llama a `gpt-4o-mini` desde el chat — devuelve transcript + lente para que Claude del chat haga la síntesis con su capacidad. Cero costo OpenAI desde el MCP. La REST API (UI web) sigue usando gpt-4o-mini y persistiendo en DB.
- **`69d1503`** MCP: `transcribe_video_url` muestra el transcript LITERAL al usuario en vez de que Claude lo sintetice. Descripción del tool reforzada con instrucciones explícitas, response reordenado (transcript primero), límite subido de 500 a 2000 palabras (~15 min de habla).

### Feature inicial — el servidor MCP completo
- **`c7f222e`** Servidor MCP remoto con OAuth 2.1 para Claude.ai y otros clientes
  - **OAuth 2.1** completo:
    - Dynamic Client Registration (RFC 7591) — Claude.ai se auto-registra
    - Protected Resource Metadata (RFC 9728) y Authorization Server Metadata (RFC 8414)
    - PKCE S256 obligatorio
    - Refresh token rotation
    - Cookie HMAC de 10min para el flujo authorize → login → consent
  - **Authorize + consent UI** server-rendered (HTML/CSS puro, sin React, escapado XSS)
  - **Endpoint `/mcp`** Streamable HTTP stateless (server + transport nuevos por request)
  - **4 tools** de Transcribe:
    - `list_my_transcriptions` — paginado, filtrable por plataforma
    - `transcribe_video_url` — sync, devuelve id + preview + metadata enriquecida
    - `get_transcription` — completo o chunkeado, incluye análisis si existe
    - `analyze_ideas` — devuelve lente para que Claude lo aplique
  - **Filtrado de tools por scope OAuth** concedido
  - **Metadata enriquecida** (helper `_videoMetadataFormat.js`): engagement raw + rates con misma fórmula que `VideoMetadataCard.jsx`, hashtags, descripción del creador, dedup del handle TikTok numérico
  - **Vars Render**: `MCP_BASE_URL`, `OAUTH_SESSION_SECRET` (autogenerado)
- **Deploy** en `https://as-tools.algosentido.com/mcp`

---

## Cambios anteriores

Para cambios antes de esta fecha, ver `git log`.
