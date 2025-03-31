# Viraler IA

Una aplicación web moderna que permite transcribir contenido de videos de diferentes plataformas (Instagram Reels, TikTok, YouTube) utilizando inteligencia artificial.

![Captura de pantalla de Viraler IA](./public/screenshot.png)

## Características

- ✅ Extracción de audio de videos de Instagram Reels, TikTok, YouTube videos y YouTube Shorts
- ✅ Transcripción automática mediante OpenAI Whisper
- ✅ Guardado de transcripciones para acceso posterior
- ✅ Interfaz moderna y responsive
- ✅ Modo oscuro/claro
- ✅ Búsqueda y filtrado de transcripciones guardadas
- ✅ Panel de administración para monitorear uso y costos de API
- ✅ Seguimiento detallado del uso de la API de OpenAI y costos estimados

## Tecnologías

- **Frontend**: React 18, React Router, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Extracción de audio**: yt-dlp
- **Transcripción**: OpenAI Whisper API
- **Empaquetado**: Vite

## Requisitos Previos

- Node.js 18.0 o superior
- Cuenta en OpenAI con API key
- yt-dlp instalado en el sistema (para extracción de audio)
- FFmpeg instalado (requerido para procesar audio)
- Git (para clonar el repositorio)

## Instalación y Ejecución

1. Clona el repositorio:
   ```
   git clone https://github.com/tu-usuario/viraler-ia.git
   cd viraler-ia
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto basado en el `.env.example`:
   ```
   cp .env.example .env
   ```

4. Edita el archivo `.env` para agregar tu API key de OpenAI y configurar la ruta a FFmpeg si es necesario:
   ```
   OPENAI_API_KEY=tu-api-key-aquí
   FFMPEG_PATH=/ruta/a/ffmpeg  # Opcional, si FFmpeg no está en el PATH
   ```

5. Asegúrate de tener FFmpeg instalado:
   ```
   # macOS con Homebrew
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install ffmpeg
   
   # Windows (con chocolatey)
   choco install ffmpeg
   ```

6. Instala yt-dlp (necesario para extraer audio de los videos):
   ```
   # macOS con Homebrew
   brew install yt-dlp
   
   # Ubuntu/Debian
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   
   # Windows (con chocolatey)
   choco install yt-dlp
   ```

7. Crea una carpeta `data` en la raíz del proyecto para almacenar los datos de uso:
   ```
   mkdir data
   ```

8. Ejecuta el servidor de desarrollo:
   ```
   npm run dev
   ```

9. Abre tu navegador en la dirección indicada (normalmente http://localhost:5173)

## Uso de la Aplicación

1. **Transcribir un video**:
   - Ve a la página principal
   - Ingresa la URL de un video (formatos soportados: Instagram Reel, TikTok, YouTube video o YouTube Short)
   - Haz clic en "Transcribir Contenido"
   - Espera mientras se procesa (el tiempo varía según la duración del video)

2. **Ver y guardar transcripciones**:
   - Una vez completado, verás la transcripción en pantalla
   - Puedes ver información del costo con el botón "Info"
   - Puedes copiar el texto usando el botón "Copiar"
   - Guarda la transcripción haciendo clic en "Guardar"

3. **Acceder a transcripciones guardadas**:
   - Haz clic en "Mis Resultados" en la navegación
   - Verás todas tus transcripciones guardadas
   - Puedes buscar por texto o filtrar por plataforma
   - Haz clic en el ícono de ojo para ver el contenido completo

4. **Monitorear uso y costos**:
   - Haz clic en "Admin" en la navegación
   - Verás estadísticas de uso incluyendo:
     - Número total de transcripciones
     - Minutos de audio procesados
     - Costo estimado basado en tarifas de OpenAI
   - También verás un historial de uso por fecha
   - Puedes reiniciar contadores o eliminar registros específicos

NOTA: Las transcripciones se almacenan localmente en tu navegador. Si limpias los datos del navegador, perderás tus transcripciones guardadas. Sin embargo, el registro de uso se guarda en el servidor en la carpeta `data`.

## Estructura del proyecto

```
viraler-ia/
├── api/                  # Lógica del backend
│   ├── utils/            # Utilidades para el backend
│   │   ├── platformDetector.js  # Detector de plataformas de video
│   │   └── usageTracker.js  # Seguimiento de uso de API
│   ├── extractAudio.js   # Función para extraer audio
│   ├── transcribeAudio.js # Función para transcribir con Whisper
│   └── transcribeVideo.js # Endpoint principal que conecta todo
├── data/                 # Almacenamiento de datos de uso (creada manualmente)
│   └── usage.json        # Registro de uso de la API (generado automáticamente)
├── public/               # Activos estáticos
│   ├── logo.svg          # Logo de la aplicación
│   └── screenshot.png    # Captura de pantalla para el README
├── src/                  # Código fuente del frontend
│   ├── components/       # Componentes React
│   │   ├── Footer.jsx    # Pie de página
│   │   ├── Header.jsx    # Cabecera con navegación
│   │   ├── SavedTranscriptions.jsx # Lista de transcripciones guardadas
│   │   ├── Spinner.jsx   # Componente de carga
│   │   ├── TranscriptionForm.jsx # Formulario para ingresar URLs
│   │   └── TranscriptionResults.jsx # Resultados de transcripción
│   ├── context/          # Contextos de React
│   │   └── TranscriptionContext.jsx # Gestión del estado global
│   ├── hooks/            # Custom hooks
│   │   ├── useLocalStorage.js # Hook para persistencia en localStorage
│   │   └── useTranscription.js # Hook para gestión de transcripciones
│   ├── pages/            # Páginas de la aplicación
│   │   ├── AdminPanel.jsx # Panel de administración y estadísticas
│   │   ├── Home.jsx      # Página principal
│   │   ├── MyResults.jsx # Página de resultados guardados
│   │   └── NotFound.jsx  # Página 404
│   ├── services/         # Servicios para API
│   │   ├── api.js        # Cliente API
│   │   ├── usageStats.js # Servicio para estadísticas de uso
│   │   └── videoExtractor.js # Servicio de extracción de videos
│   ├── utils/            # Utilidades y helpers
│   │   ├── formatters.js # Formateo de datos
│   │   └── validation.js # Validación de entradas
│   ├── App.jsx           # Componente principal con rutas
│   ├── index.css         # Estilos globales con Tailwind
│   └── main.jsx          # Punto de entrada de React
├── .env                  # Variables de entorno (no incluido en el repo)
├── .env.example          # Ejemplo de variables de entorno
├── package.json          # Dependencias y scripts
├── postcss.config.js     # Configuración de PostCSS
├── README.md             # Documentación
├── server.js             # Servidor Express
├── tailwind.config.js    # Configuración de Tailwind CSS
└── vite.config.js        # Configuración de Vite
```

## Monitoreo de Uso y Costos

La aplicación incluye un sistema completo de seguimiento de uso de la API de OpenAI:

- **Panel de administración**: Accesible en la ruta `/admin`
- **Métricas que se rastrean**:
  - Número total de transcripciones realizadas
  - Minutos totales de audio procesados
  - Costo estimado basado en tarifas actuales de OpenAI
  - Historial de uso por fecha
- **Acciones disponibles**:
  - Reiniciar contadores (manteniendo o eliminando historial)
  - Eliminar registros específicos por fecha
  - Visualizar estadísticas detalladas

Estos datos se almacenan en el archivo `data/usage.json` y proporcionan transparencia sobre el uso y costo de la API.

## Solución de Problemas

### Errores Comunes

1. **Error: "FFmpeg not found"**
   - Instala FFmpeg en tu sistema
   - O especifica la ruta a FFmpeg en el archivo .env con FFMPEG_PATH=/ruta/a/ffmpeg

2. **Error: "No se pudo extraer audio del video"**
   - Verifica que yt-dlp esté correctamente instalado: `yt-dlp --version`
   - Actualiza yt-dlp: `yt-dlp -U`
   - Asegúrate de que la URL del video sea válida y accesible

3. **Error: "API Key de OpenAI no configurada"**
   - Verifica que el archivo .env exista y contenga OPENAI_API_KEY=tu-api-key
   - Reinicia el servidor de desarrollo

4. **Error: "No se pudo transcribir el audio"**
   - Verifica que tu API key de OpenAI sea válida
   - Asegúrate de tener saldo disponible en tu cuenta de OpenAI

### Límites y Consideraciones

- La aplicación está diseñada para videos cortos (menos de 10 minutos)
- Algunos videos pueden estar protegidos y no ser accesibles
- Las transcripciones se almacenan solo localmente (no en la nube)
- Los costos estimados son aproximados y basados en las tarifas publicadas de OpenAI

## Contribución

1. Haz un fork del proyecto
2. Crea tu rama de característica (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'feat: add amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.