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

## Tecnologías

- **Frontend**: React 18, React Router, TanStack Query, Tailwind CSS
- **Backend**: Funciones serverless (Vercel/Netlify)
- **Extracción de audio**: youtube-dl-exec
- **Transcripción**: OpenAI Whisper API
- **Empaquetado**: Vite

## Requisitos Previos

- Node.js 18.0 o superior
- Cuenta en OpenAI con API key
- yt-dlp instalado en el sistema (para extracción de audio)
- Vercel CLI (para las funciones serverless)
- Git (para clonar el repositorio)

NOTA: La aplicación utiliza funciones serverless de Vercel para manejar la extracción de audio y la transcripción, por lo que es necesario tener configurado el entorno de desarrollo de Vercel.

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

3. Crea un archivo `.env` en la raíz del proyecto con tu API key de OpenAI:
   ```
   OPENAI_API_KEY=tu-api-key-aquí
   ```

4. Instala yt-dlp (necesario para extraer audio de los videos):
   ```
   # macOS con Homebrew
   brew install yt-dlp
   
   # Ubuntu/Debian
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   
   # Windows (con chocolatey)
   choco install yt-dlp
   ```

5. Instala la CLI de Vercel (necesaria para las funciones serverless):
   ```
   npm install -g vercel
   ```

6. Ejecuta el entorno de desarrollo serverless:
   ```
   vercel dev
   ```

7. En otra terminal, ejecuta el servidor de desarrollo frontend:
   ```
   npm run dev
   ```

8. Abre tu navegador en la dirección indicada (normalmente http://localhost:5173)
   
NOTA: Debes tener ambos servidores ejecutándose simultáneamente (el servidor frontend y el servidor de funciones serverless).

## Despliegue en Producción

### Vercel (Recomendado)

Esta aplicación está diseñada para desplegarse en Vercel:

1. Instala la CLI de Vercel (si aún no lo has hecho):
   ```
   npm install -g vercel
   ```

2. Inicia sesión en Vercel:
   ```
   vercel login
   ```

3. Despliega tu aplicación:
   ```
   vercel
   ```

4. Configura las variables de entorno en el dashboard de Vercel:
   - `OPENAI_API_KEY`: Tu API key de OpenAI

5. Realiza el despliegue final:
   ```
   vercel --prod
   ```

IMPORTANTE: Asegúrate de que Vercel tenga acceso a yt-dlp en su entorno. Puedes necesitar configurar opciones adicionales en el archivo `vercel.json` para instalar dependencias del sistema.

## Uso de la Aplicación

1. **Transcribir un video**:
   - Ve a la página principal
   - Ingresa la URL de un video (formatos soportados: Instagram Reel, TikTok, YouTube video o YouTube Short)
   - Haz clic en "Transcribir Contenido"
   - Espera mientras se procesa (el tiempo varía según la duración del video)

2. **Ver y guardar transcripciones**:
   - Una vez completado, verás la transcripción en pantalla
   - Puedes copiar el texto usando el botón "Copiar"
   - Guarda la transcripción haciendo clic en "Guardar"

3. **Acceder a transcripciones guardadas**:
   - Haz clic en "Mis Resultados" en la navegación
   - Verás todas tus transcripciones guardadas
   - Puedes buscar por texto o filtrar por plataforma
   - Haz clic en el ícono de ojo para ver el contenido completo

4. **Eliminar transcripciones**:
   - En la sección "Mis Resultados"
   - Haz clic en el ícono de papelera junto a la transcripción
   - Confirma la eliminación

NOTA: Las transcripciones se almacenan localmente en tu navegador. Si limpias los datos del navegador, perderás tus transcripciones guardadas.

## Estructura del proyecto

```
viraler-ia/
├── api/                  # Funciones serverless (Vercel Functions)
│   ├── utils/            # Utilidades para las funciones serverless
│   │   └── platformDetector.js  # Detector de plataformas de video
│   ├── extractAudio.js   # Función para extraer audio
│   ├── transcribeAudio.js # Función para transcribir con Whisper
│   └── transcribeVideo.js # Endpoint principal que conecta todo
├── public/               # Activos estáticos
│   ├── assets/           # Imágenes y otros recursos
│   ├── favicon.ico       # Icono del sitio
│   └── logo.svg          # Logo de la aplicación
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
│   │   ├── Home.jsx      # Página principal
│   │   ├── MyResults.jsx # Página de resultados guardados
│   │   └── NotFound.jsx  # Página 404
│   ├── services/         # Servicios para API
│   │   ├── api.js        # Cliente API
│   │   └── videoExtractor.js # Servicio de extracción de videos
│   ├── utils/            # Utilidades y helpers
│   │   ├── formatters.js # Formateo de datos
│   │   └── validation.js # Validación de entradas
│   ├── App.jsx           # Componente principal con rutas
│   ├── index.css         # Estilos globales con Tailwind
│   └── main.jsx          # Punto de entrada de React
├── .env                  # Variables de entorno (no incluido en el repo)
├── package.json          # Dependencias y scripts
├── postcss.config.js     # Configuración de PostCSS
├── README.md             # Documentación
├── tailwind.config.js    # Configuración de Tailwind CSS
├── vercel.json           # Configuración de Vercel (si es necesario)
└── vite.config.js        # Configuración de Vite
```

## Contribución

Las contribuciones son bienvenidas. Por favor, abre un issue primero para discutir lo que te gustaría cambiar o añadir.

## Licencia

[MIT](LICENSE)

## Solución de Problemas

### Errores Comunes

1. **Error: "No se puede conectar con el servidor de funciones"**
   - Asegúrate de tener ejecutando `vercel dev` en una terminal
   - Verifica que no haya otro servicio usando el puerto 3000

2. **Error: "No se pudo extraer audio del video"**
   - Verifica que yt-dlp esté correctamente instalado: `yt-dlp --version`
   - Actualiza yt-dlp: `yt-dlp -U`
   - Asegúrate de que la URL del video sea válida y accesible

3. **Error: "API Key de OpenAI no configurada"**
   - Verifica que el archivo .env exista y contenga OPENAI_API_KEY=tu-api-key
   - Reinicia los servidores de desarrollo

4. **Error: "No se pudo transcribir el audio"**
   - Verifica que tu API key de OpenAI sea válida
   - Asegúrate de tener saldo disponible en tu cuenta de OpenAI

### Límites y Consideraciones

- La aplicación está diseñada para videos cortos (menos de 10 minutos)
- Algunos videos pueden estar protegidos y no ser accesibles
- Las transcripciones se almacenan solo localmente (no en la nube)

## Contacto y Soporte

Para preguntas, problemas o sugerencias:
1. Abre un issue en este repositorio
2. Describe detalladamente el problema incluyendo:
   - Pasos para reproducir el error
   - Mensajes de error (si existen)
   - Información del entorno (sistema operativo, versión de Node.js)
   - URL del video (si es relevante y no es privado)