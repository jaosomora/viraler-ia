# Algo Sentido Tools (AS Tools)

Suite de herramientas internas de Algo Sentido. Aplicación web full-stack con login, panel admin y varias herramientas integradas:

- **Transcribir** — Extrae transcripciones de videos de YouTube, Instagram Reels, TikTok y Facebook (OpenAI `gpt-4o-mini-transcribe`).
- **Convertir** — Convierte documentos PDF, DOCX, PPTX, XLSX y EPUB a Markdown o HTML (Microsoft MarkItDown + pymupdf4llm).
- **Secretos** — Comparte credenciales o información sensible mediante un link cifrado (AES-256-GCM). Solo el owner puede ver el contenido. Caduca a 30 días.
- **Magic Link login** — Login sin contraseña por email (Resend). Útil cuando un usuario olvida su contraseña.

![Captura de pantalla](./public/screenshot.png)

## Inicio rápido (local)

```bash
./start.sh
```

El script verifica dependencias (`node`, `ffmpeg`, `yt-dlp`, `markitdown`), avisa si falta `.env`, genera automáticamente la `SECRETS_ENCRYPTION_KEY` si no existe, y arranca frontend (5173) + backend (3000) abriendo el navegador.

Si prefieres comandos sueltos:

```bash
npm install
npm run dev    # frontend + backend en paralelo
```

## Setup desde cero en un servidor nuevo

Pasos completos para levantar AS Tools desde un repositorio limpio en una máquina nueva.

### 1. Clonar e instalar

```bash
git clone <repo-url> as-tools
cd as-tools
npm install
```

### 2. Dependencias del sistema

```bash
# macOS (Homebrew)
brew install ffmpeg yt-dlp
pipx install 'markitdown[all]'

# Linux (Debian/Ubuntu)
sudo apt update && sudo apt install -y ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
pipx install 'markitdown[all]'
```

### 3. `.env`

```bash
cp .env.example .env
```

Edítalo y completa al menos:

```
OPENAI_API_KEY=sk-...                 # transcripciones
ANTHROPIC_API_KEY=sk-ant-...          # opcional, fallback de LLM
JWT_SECRET=cadena-larga-aleatoria
SECRETS_ENCRYPTION_KEY=               # se autogenera con start.sh si falta
RESEND_API_KEY=re_...                 # ver paso 4
MAGIC_LINK_FROM_EMAIL=hola@tu-dominio.com   # NO uses "noreply@" — Resend lo penaliza
APP_BASE_URL=https://tu-dominio.com         # URL pública desde la que se accede a la app
```

### 4. Resend (Magic Link login)

Para que los usuarios puedan iniciar sesión por email cuando olvidan su contraseña.

1. **Crear cuenta** en [resend.com](https://resend.com).
2. **API key**: Settings → API Keys → "Create API Key" → cópiala a `RESEND_API_KEY` en `.env`.
3. **Verificar dominio** (obligatorio para enviar emails a usuarios reales; sin verificar solo puedes enviarte a ti mismo):
   - Resend → Domains → "Add Domain" → escribe tu dominio (ej: `algosentido.com`).
   - Resend te muestra **3 registros DNS** que debes crear en tu proveedor (Cloudflare, GoDaddy, Namecheap, etc.):

     | Tipo | Nombre | Valor | Prioridad |
     |------|--------|-------|-----------|
     | TXT  | `resend._domainkey` | (la cadena `p=MIGfMA...wIDAQAB` que muestra Resend) | — |
     | MX   | `send` | `feedback-smtp.<region>.amazonses.com` | 10 |
     | TXT  | `send` | `v=spf1 include:amazonses.com ~all` | — |

   - **NO** actives "Enable Receiving" (interferiría con tu correo del dominio si lo tienes en Google Workspace, Zoho, etc.).
   - Algunos proveedores piden el nombre relativo (`send`, `resend._domainkey`); otros piden el absoluto (`send.tu-dominio.com`). Si Resend no verifica con el corto, prueba con el largo.
   - Click **"I've added the records"** y espera la propagación (5–60 min, a veces hasta 24h).
4. **Setear el remitente**: en `.env`, `MAGIC_LINK_FROM_EMAIL=hola@tu-dominio.com` (cualquier dirección del dominio verificado). **Evita `noreply@`** — Resend lo penaliza en su análisis de deliverability y los usuarios pierden la opción de responder si tienen problemas.
5. Si todavía no tienes dominio verificado, puedes usar `MAGIC_LINK_FROM_EMAIL=onboarding@resend.dev` para pruebas — pero solo te llegarán emails al correo dueño de la cuenta Resend.
6. **Sin `RESEND_API_KEY`**: el sistema imprime el magic link en la consola del backend en lugar de enviar email. Útil en dev local.

### 5. Primer arranque

```bash
./start.sh
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

El primer usuario que se registre queda automáticamente como `owner` (admin). Crea tu cuenta y guárdala bien.

### 6. Despliegue en Render (producción)

Ya hay `Dockerfile` listo. En Render:
- Web Service → Docker → conecta el repo.
- Variables de entorno: copia las de tu `.env` (todas las del paso 3).
- En `APP_BASE_URL` pon la URL pública de Render (`https://tu-app.onrender.com`).
- Disco persistente: Mount Path `/opt/data`, 1 GB.

## Características

- ✅ Login con email/contraseña y JWT
- ✅ Roles `owner` y `member` (el primer usuario registrado queda como owner)
- ✅ Panel admin con métricas, gestión de usuarios y reset de contraseñas
- ✅ Transcripción de videos de YouTube, Instagram Reels, TikTok, Facebook
- ✅ Conversión de documentos (PDF/DOCX/PPTX/XLSX/EPUB) a Markdown/HTML
- ✅ Secretos cifrados con AES-256-GCM, caducidad automática a 30 días
- ✅ SQLite local (sin BD externa) — archivo en `data/as-transcribe.db`
- ✅ Modo oscuro/claro
- ✅ Despliegue en Render (Docker)

## Tecnologías

- **Frontend**: React 18, React Router, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Extracción de audio**: yt-dlp, FFmpeg
- **Transcripción**: OpenAI Whisper API
- **Empaquetado**: Vite
- **Contenedorización**: Docker, Docker Compose

## Requisitos Previos

### Desarrollo tradicional (sin Docker)
- Node.js 18.0 o superior
- Cuenta en OpenAI con API key
- yt-dlp instalado en el sistema (para extracción de audio)
- FFmpeg instalado (requerido para procesar audio)
- Git (para clonar el repositorio)

### Desarrollo con Docker
- Docker y Docker Compose instalados
- Cuenta en OpenAI con API key
- Git (para clonar el repositorio)

## Instalación y Ejecución

### Método 1: Instalación Tradicional (sin Docker)

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/as-transcribe.git
   cd as-transcribe
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto basado en el `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edita el archivo `.env`:
   ```
   OPENAI_API_KEY=tu-api-key-de-openai
   ANTHROPIC_API_KEY=tu-api-key-de-anthropic     # opcional, fallback de LLM
   JWT_SECRET=cualquier-cadena-larga-y-secreta
   SECRETS_ENCRYPTION_KEY=64-chars-hex            # genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   FFMPEG_PATH=/ruta/a/ffmpeg                    # opcional
   ```

   `start.sh` genera `SECRETS_ENCRYPTION_KEY` automáticamente si falta.

5. Asegúrate de tener FFmpeg instalado (crucial para el procesamiento de audio):
   ```bash
   # macOS con Homebrew
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install ffmpeg
   
   # Windows (con chocolatey)
   choco install ffmpeg
   ```

6. Instala yt-dlp (necesario para extraer audio de los videos):
   ```bash
   # macOS con Homebrew
   brew install yt-dlp
   
   # Ubuntu/Debian
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   
   # Windows (con chocolatey)
   choco install yt-dlp
   ```

7. Crea una carpeta `data` en la raíz del proyecto para almacenar los datos de uso:
   ```bash
   mkdir data
   ```

8. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```

9. Abre tu navegador en la dirección indicada (normalmente http://localhost:5173)

### Método 2: Instalación con Docker (recomendada)

Usar Docker simplifica enormemente la configuración, ya que no necesitas instalar FFmpeg o yt-dlp manualmente. Todo viene preconfigurado en el contenedor.

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/as-transcribe.git
   cd as-transcribe
   ```

2. Crea un archivo `.env` en la raíz del proyecto:
   ```bash
   cp .env.example .env
   ```

3. Edita el archivo `.env` para agregar tu API key de OpenAI:
   ```
   OPENAI_API_KEY=tu-api-key-aquí
   ```

4. Crea la carpeta de datos y la carpeta config:
   ```bash
   mkdir -p data config
   ```

5. (Opcional) Para acceder a videos privados de Instagram, exporta las cookies desde tu navegador e incluye el archivo como `config/instagram_cookies.txt`.

6. Construye y ejecuta los contenedores Docker:
   ```bash
   # Construir la imagen Docker
   npm run docker:build
   
   # Iniciar los contenedores
   npm run docker:start
   ```

7. Accede a la aplicación en tu navegador:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

8. Para detener los contenedores:
   ```bash
   npm run docker:stop
   ```

## Desarrollo con Docker

El entorno Dockerizado está diseñado para proporcionar una experiencia de desarrollo fluida con hot-reload y todas las dependencias preconfiguradas.

### Comandos útiles

- **Iniciar el entorno de desarrollo**:
  ```bash
  npm run docker:start
  ```

- **Ver logs del servidor**:
  ```bash
  npm run docker:logs
  ```

- **Acceder al shell del contenedor**:
  ```bash
  npm run docker:bash
  ```

- **Detener los contenedores**:
  ```bash
  npm run docker:stop
  ```

### Estructura de Docker

- **`Dockerfile.dev`**: Configuración para el entorno de desarrollo
- **`Dockerfile`**: Configuración para producción
- **`docker-compose.yml`**: Orquestación de servicios para desarrollo

### Volúmenes montados

- El código fuente se monta en tiempo real, lo que permite ver los cambios inmediatamente
- Los `node_modules` se mantienen dentro del contenedor para evitar problemas de compatibilidad
- La carpeta `data` se monta para persistencia de datos
- La carpeta `config` se monta para configuraciones adicionales como cookies

## Configuración para Instagram

Para acceder a contenido protegido de Instagram (especialmente perfiles privados o con restricciones geográficas), necesitarás proporcionar cookies de autenticación:

1. Inicia sesión en Instagram desde tu navegador
2. Usa una extensión como "Get cookies.txt" para Chrome o Firefox
3. Exporta las cookies y guárdalas en `config/instagram_cookies.txt`
4. Reinicia los contenedores si están en ejecución

La aplicación detectará automáticamente y usará las cookies cuando sea necesario.

## Configuración de FFmpeg

FFmpeg es una dependencia **crítica** para el funcionamiento de la aplicación. Si estás usando Docker, FFmpeg ya está configurado correctamente.

### Para instalación sin Docker:

Para comprobar si FFmpeg está correctamente instalado, ejecuta en tu terminal:

```bash
ffmpeg -version
```

Si el comando funciona, FFmpeg está instalado y en tu PATH.

### Configuración manual de la ruta

Si FFmpeg está instalado pero Algo Sentido Tools: Transcribe no lo encuentra, puedes especificar la ruta exacta en el archivo `.env`:

```
FFMPEG_PATH=/ruta/completa/a/tu/ffmpeg
```

Ejemplos de rutas comunes:
- macOS: `/usr/local/bin/ffmpeg` o `/opt/homebrew/bin/ffmpeg` (con Homebrew)
- Linux: `/usr/bin/ffmpeg`
- Windows: `C:\ruta\a\ffmpeg.exe`

Para encontrar la ruta exacta en sistemas Unix, puedes usar el comando:
```bash
which ffmpeg
```

## Despliegue en Producción

### Despliegue en Render

Esta aplicación está configurada para ser desplegada en [Render](https://render.com) con Docker para máxima consistencia entre entornos.

#### Pasos para desplegar en Render

1. Crea una cuenta en Render y conéctala con tu repositorio GitHub
2. Crea un nuevo Web Service y selecciona tu repositorio
3. Configura el servicio:
   - **Environment**: Docker
   - **Branch**: main (o la rama que prefieras)
   - **Root Directory**: (dejar en blanco)
   - **Variables de entorno**: Añade OPENAI_API_KEY con tu clave API
4. Si necesitas cookies para Instagram, configura la variable de entorno `INSTAGRAM_COOKIES` con el contenido del archivo cookies.txt
5. Agrega un disco persistente:
   - **Mount Path**: /opt/data
   - **Size**: 1 GB debería ser suficiente

La aplicación detectará automáticamente que está en entorno de producción y usará las configuraciones apropiadas.

#### Para problemas específicos con Render

- Si yt-dlp no puede acceder a ciertos videos, considera usar cookies para esa plataforma
- Si necesitas depurar problemas, revisa los logs en el dashboard de Render

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
as-transcribe/
├── api/                  # Lógica del backend
│   ├── utils/            # Utilidades para el backend
│   │   ├── platformDetector.js  # Detector de plataformas de video
│   │   └── usageTracker.js  # Seguimiento de uso de API
│   ├── extractAudio.js   # Función para extraer audio
│   ├── transcribeAudio.js # Función para transcribir con Whisper
│   └── transcribeVideo.js # Endpoint principal que conecta todo
├── config/               # Configuraciones adicionales (cookies, etc.)
├── data/                 # Almacenamiento de datos de uso
├── public/               # Activos estáticos
├── src/                  # Código fuente del frontend
│   ├── components/       # Componentes React
│   ├── context/          # Contextos de React
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Páginas de la aplicación
│   ├── services/         # Servicios para API
│   ├── utils/            # Utilidades y helpers
│   ├── App.jsx           # Componente principal con rutas
│   ├── index.css         # Estilos globales con Tailwind
│   └── main.jsx          # Punto de entrada de React
├── .dockerignore         # Archivos a ignorar en Docker
├── .env                  # Variables de entorno (no incluido en el repo)
├── .env.example          # Ejemplo de variables de entorno
├── docker-compose.yml    # Configuración de Docker Compose para desarrollo
├── Dockerfile            # Configuración de Docker para producción
├── Dockerfile.dev        # Configuración de Docker para desarrollo
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

Estos datos se almacenan en la base de datos SQLite en la carpeta `data` y proporcionan transparencia sobre el uso y costo de la API.

## Solución de Problemas

### Errores Comunes

1. **Errores en Docker**
   - Si Docker no puede iniciar: Asegúrate de que Docker Desktop esté en ejecución
   - Problemas de permisos: Ejecuta los comandos con sudo en Linux
   - Puerto en uso: Cambia los puertos mapeados en `docker-compose.yml`

2. **Errores con Vite o Hot Reload**
   - Reinicia los contenedores: `npm run docker:stop && npm run docker:start`
   - Verifica los logs: `npm run docker:logs`

3. **Error: "No se pudo extraer audio del video"**
   - Para videos de Instagram: Asegúrate de tener `config/instagram_cookies.txt` actualizado
   - Para TikTok: Algunos videos están geobloqueados y pueden requerir VPN
   - Verifica si el video es accesible públicamente
   - Comprueba los logs para ver mensajes de error específicos

4. **Error: "API Key de OpenAI no configurada"**
   - Verifica que el archivo .env exista y contenga OPENAI_API_KEY=tu-api-key
   - En Docker, asegúrate de que el archivo .env se esté montando correctamente
   - En Render, verifica que la variable de entorno esté configurada

### Para Instagram específicamente

Si tienes problemas para extraer videos de Instagram, ten en cuenta:

1. Instagram limita el acceso a contenido según:
   - Si la cuenta es privada
   - Si hay restricciones geográficas
   - Si has alcanzado límites de rate-limit

2. Soluciones:
   - Usa un archivo de cookies actualizado
   - Asegúrate de que las cookies sean de una cuenta que pueda ver el contenido
   - En algunos casos, necesitarás usar una VPN

### Límites y Consideraciones

- La aplicación está diseñada para videos cortos (menos de 10 minutos)
- Algunos videos pueden estar protegidos y no ser accesibles
- Las transcripciones se almacenan solo localmente (no en la nube)
- Los costos estimados son aproximados y basados en las tarifas publicadas de OpenAI

## Optimización de Docker

El entorno Docker ha sido optimizado para:

- **Tiempo de arranque rápido** mediante capas eficientes
- **Cold starts** minimizados en entornos de producción
- **Desarrollo en tiempo real** mediante volúmenes montados
- **Consistencia** entre entornos de desarrollo y producción
- **Tamaño reducido** de imágenes mediante técnicas de multi-stage building

## Contribución

1. Haz un fork del proyecto
2. Crea tu rama de característica (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'feat: add amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.