# Changelog

Cambios relevantes del proyecto AS Tools. Una línea por commit que afecte funcionalidad,
ordenado por fecha descendente. Para detalles del MCP server ver `docs/MCP.md`.

> Convención: cada commit que toque `api/mcp/*`, `api/oauth/*`, o que cambie endpoints/services
> del backend, debe agregar entrada aquí. El hook PostToolUse lo recordará.

---

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
