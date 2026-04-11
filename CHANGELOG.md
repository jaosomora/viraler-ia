# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
