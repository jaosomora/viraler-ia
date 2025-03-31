# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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