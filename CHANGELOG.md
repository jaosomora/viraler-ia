# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-05-06

Reescritura mayor del editor de AS Clips: pipeline split, edición en vivo sin re-render, paquete de fuentes y plantillas con estética editorial "Algo Sentido".

### Añadido — Pipeline Opus-style (split base + export)
- `renderClipBase` (cut + crop + zoompan, sin subs, generado 1 sola vez por combinación de params)
- `burnSubtitlesOnBase` (rápido: solo .ass burn-in sobre base ya cropeado)
- Endpoints `GET /api/clips/:id/captions`, `GET /:id/base-video`, `POST /:id/export`
- Columnas `clips.render_mode`, `base_video_path`, `base_params_hash`, `caption_overrides`
- Auto-persist debounced en cambios de trim/aspect/camera/transition

### Añadido — Edición en vivo de subtítulos
- `LiveCaptionOverlay` sincronizado con `<video>` vía requestAnimationFrame
- `TranscriptProseView` con click-to-seek por palabra y resaltado de chunk activo
- `CaptionChunkEditor` con override de texto, ocultar, reset al original
- Word-active highlight (palabra dicha = scale 1.08 + brightness)
- Pop animation del chunk al cambiar (CSS keyframes en preview + `\fad\\t\\fscx` en .ass)

### Añadido — Estilo granular del texto
- Color, tamaño en px, italic, underline para hook / caption / keyword separados
- `keyword_bg_color` con opacidad (estilo marcador) — preview HTML + truco ASS de outline grueso
- `outline_color` independiente del color del texto
- Karaoke `\k<dur>` per-word en .ass + UI toggle + slider de dim opacity. Solo en MP4 exportado

### Añadido — Transiciones (validadas con export real)
- 7 modos: none, fade-in, fade-out, fade-cross, zoom-in, zoom-out, zoom-cross
- `TransitionFader` simula fades en preview con CSS opacity
- Composición correcta con `camera_motion` (zoom transition pisa al motion en bordes)

### Añadido — Plantillas con estética "Algo Sentido"
- 5 templates editoriales: **Editorial** (Playfair + Lora + oro envejecido), **Documentary** (Inter neutro TED-style), **Boutique** (Lato + DM Serif Italic + oro metálico), **Whisper** (Inter Regular sin outline), **Manuscrito** (EB Garamond + Caveat + terracota)
- Aplicar a un clip o a todos los del job (shift+click o botón "→ todos")
- Plantillas user-defined: tabla `clip_templates`, "+ Guardar este estilo"
- **Default de clips nuevos = Editorial** (antes: Anton + Inter SemiBold + amarillo neón)

### Añadido — Catálogo de fuentes empaquetado
- 30 TTFs en `assets/fonts/` (Playfair Display, Lora, EB Garamond, DM Serif Display, Cormorant + italics; Inter, Roboto, Lato, Montserrat, etc.)
- `scripts/download-fonts.sh` baja desde repo google/fonts; re-ejecutable
- 19 fuentes caption + 20 fuentes keyword agrupadas por carácter en el dropdown
- Single source of truth: `FONT_FAMILY` + `FONT_WEIGHT` + `FONT_ITALIC` exportados desde `LiveCaptionOverlay.jsx`
- **Crítico**: antes el burn-in caía a fallback del sistema (DejaVu en Linux); ahora preview ↔ MP4 final coinciden visualmente

### Añadido — UX del editor
- 5 secciones colapsables: Texto / Estilo / Subtítulos / Movimiento / Salida (estado persistente en localStorage)
- Tooltips con `?` en conceptos no obvios (Hook, Keywords, Cámara vs Transición, Borde, Karaoke)
- Banner gancho auto + toggle por clip + endpoint masivo `disable-hooks`
- Recovery automático de jobs zombie al startup del server

### Añadido — Tooling
- `scripts/test-transitions.mjs`, `test-pop-animation.mjs`, `test-karaoke.mjs` para validación end-to-end
- `.claude/sync-memories.sh` ahora soporta worktrees (usa `--git-common-dir`)

### Modificado
- Editor reorganizado de 9 secciones planas a 5 grupos colapsables + plantillas siempre visibles
- Botón "Descargar clip editado" → "Exportar MP4 con subtítulos" (refleja separación base/export)
- ClipsPage banner muestra "Gancho auto añadido" después de generar

### Corregido
- Rules-of-hooks violado en `ClipEditor.jsx` causaba pantalla negra al abrir el editor
- `process.env` referenciado en `AdminPanel.jsx` (no existe en Vite client)
- Botón play del card quedaba detrás del overlay text (z-index 30 explícito)
- Outline negro sobre texto negro hacía letra ilegible (`outline_color` configurable)
- `\r` en keyword overrides mataba la animación pop (cambiado a `\rCaption`)

## [2.2.0] - 2026-04-11

### Añadido
- **Nueva herramienta Convert** — Conversión de documentos (PDF, DOCX, PPTX, XLSX, EPUB) a Markdown usando Microsoft MarkItDown
- **ToolHub** — Nueva página de inicio (`/`) como dashboard de herramientas internas
- Endpoint `api/convertDocument.js` que ejecuta MarkItDown vía child_process
- Componentes: `ConvertForm`, `ConversionResults`, `SavedConversions`
- Página `ConvertPage` en `/convertir` con su propio `ConversionContext`
- Tabla `conversions` en SQLite + tracking en `usageTrackerSQLite.js`
- Tab de Conversiones en `MyResults` y sección en `AdminPanel`
- Variable de entorno `MARKITDOWN_PATH` (opcional)
- Dependencia externa: `markitdown` (Python CLI, `pipx install 'markitdown[all]'`)

### Modificado
- Rebranding completo: ViralAI → **AS Transcribe** (Algo Sentido Tools)
- `Header`/`Footer` con enlaces a Transcribe, Convert y ToolHub
- `App.jsx`: nueva ruta `/convertir`, `/` ahora muestra ToolHub
- `Dockerfile`: instala `markitdown` además de yt-dlp y ffmpeg
- JWT extendido de 7 a 30 días
- Vista de admin mejorada con listado de transcripciones

### Corregido
- Hook `PostToolUse` en `.claude/settings.json` apuntaba a ruta obsoleta de otra máquina

## [2.1.0] - 2025-04-11

### Añadido
- Sistema de autenticación con email/password (bcryptjs + JWT)
- Roles de usuario: owner (primer registro) y member
- Cada usuario solo ve sus propias transcripciones
- Panel Admin restringido solo al owner
- Página de Login/Registro con mensaje motivador
- Botón "Salir" y nombre del usuario en el header
- Middleware authMiddleware y ownerOnly en el backend
- Tabla `users` en la base de datos
- Columna `user_id` en `transcriptions` para separar datos por usuario
- Variable de entorno `JWT_SECRET`

### Modificado
- Todas las rutas API protegidas con JWT (excepto login/register y health)
- TranscriptionContext usa authFetch con token automático
- Header muestra "Admin" solo para owner
- App.jsx redirige a LoginPage si no autenticado

## [2.0.0] - 2025-04-11

### Eliminado
- Sistema RAG completo (documentProcessor, document_vectors, embeddings)
- Módulo de Clientes (CRUD, rutas, controladores, páginas, servicios)
- Módulo de Scripts/Guiones (CRUD, generación, conversaciones)
- Módulo de Logs de API (rutas, controladores, páginas, componentes)
- Auth system no utilizado (passport, Google OAuth, middleware)
- Dependencias: natural, lodash-es, markdown-it
- 9 tablas de base de datos reducidas a 3 (transcriptions, usage_stats, settings)
- Tablas duplicadas en schema.js corregidas

### Modificado
- AdminPanel simplificado (solo estadísticas de transcripción)
- Navegación reducida a: Transcribir, Mis Resultados, Admin
- Modelo de transcripción actualizado a gpt-4o-mini-transcribe en UI

## [1.3.0] - 2025-04-11

### Añadido
- Soporte para transcripción de videos de Facebook (URLs de facebook.com y fb.watch)
- Subida directa de archivos de video/audio para transcripción (hasta 500 MB)
- Nuevo endpoint `POST /api/transcribeUpload` con multer para manejo de archivos
- Nuevo archivo `api/transcribeUpload.js` con extracción de audio via FFmpeg
- Interfaz con tabs "Pegar URL" / "Subir Archivo" con zona de drag & drop
- Dependencia `multer` para manejo de uploads multipart
- Archivo `CLAUDE.md` con contexto completo del proyecto
- Configuración `.claude/settings.json` para Claude Code

### Modificado
- Modelo de transcripción cambiado de `whisper-1` a `gpt-4o-mini-transcribe` (50% más barato)
- Cálculo de costos actualizado de $0.006/min a $0.003/min
- `platformDetector.js` ahora soporta Facebook como plataforma válida
- `extractAudio.js` incluye headers anti-bloqueo para Facebook
- `TranscriptionForm.jsx` rediseñado con soporte dual URL/archivo
- `TranscriptionContext.jsx` incluye `processFileTranscription()` y detección de Facebook
- `.gitignore` actualizado para incluir archivos de configuración de Claude Code

## [1.2.0] - 2025-04-11

### Añadido
- Fallback automático a OpenAI cuando la API key de Anthropic no está disponible
- Servicio LLM unificado (`llmService.js`) que selecciona proveedor automáticamente
- Soporte para `openaiService.js` como alternativa a Anthropic para generación de guiones

## [1.1.0] - 2025-03-31

### Añadido
- Panel de administración para monitoreo de uso de API
- Sistema de seguimiento detallado de uso de la API de OpenAI
- Registro de costos estimados basados en tarifas actuales
- Funcionalidad para reiniciar contadores y eliminar registros de uso
- Visualización del costo individual por transcripción
- Corrección de errores en la detección de FFmpeg
- Documentación actualizada para incluir nuevas funcionalidades

### Modificado
- Mejorado sistema de manejo de errores en la extracción de audio
- Configuración actualizada para especificar ruta a FFmpeg
- Estructura del proyecto optimizada para mejor organización
- Componentes de UI actualizados para mostrar información de uso

## [1.0.0] - 2025-03-30

### Añadido
- Funcionalidad inicial para transcribir videos de Instagram Reels, TikTok y YouTube
- Interfaz de usuario con React y Tailwind CSS
- Sistema de guardado de transcripciones en localStorage
- Modo oscuro/claro
- Validación de URLs para diferentes plataformas
- Extracción de audio usando yt-dlp
- Transcripción mediante OpenAI Whisper API
- Página de resultados guardados con búsqueda y filtrado
- Backend con Express.js
