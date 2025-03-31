# Viraler IA

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/tu-usuario/viraler-ia)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/tu-usuario/viraler-ia/blob/main/LICENSE)

Una aplicación web moderna que permite transcribir contenido de videos de diferentes plataformas (Instagram Reels, TikTok, YouTube) utilizando inteligencia artificial.

## 🚀 Características

- **Transcripción de videos** de Instagram Reels, TikTok, YouTube
- **Extracción automática de audio** con yt-dlp
- **Transcripción con IA** usando OpenAI Whisper
- **Almacenamiento local** de transcripciones
- **Interfaz moderna** con modo oscuro/claro
- **Búsqueda y filtrado** de transcripciones guardadas
- **Panel de administración** para monitoreo de uso y costos
- **Seguimiento detallado** del uso de la API de OpenAI

## 🛠️ Stack tecnológico

- **Frontend**: React, React Router, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Extracción**: youtube-dl-exec (yt-dlp)
- **IA**: OpenAI Whisper API
- **Empaquetado**: Vite

## 📋 Prerrequisitos

- Node.js 18.0 o superior
- yt-dlp instalado
- FFmpeg instalado
- Cuenta en OpenAI con API key

## 🔧 Instalación

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/viraler-ia.git
   cd viraler-ia
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar entorno**:
   ```bash
   cp .env.example .env
   # Edita el archivo .env y agrega tu API key de OpenAI
   ```

4. **Crear carpeta de datos**:
   ```bash
   mkdir data
   ```

5. **Iniciar en modo desarrollo**:
   ```bash
   npm run dev
   ```

## 📊 Monitoreo de Uso

La aplicación incluye un panel de administración accesible en `/admin` que permite:

- Visualizar el número total de transcripciones
- Ver minutos de audio procesados
- Monitorear costos estimados de la API
- Revisar historial de uso por fecha
- Reiniciar contadores o eliminar registros específicos

## 🏗️ Estructura del proyecto

```
viraler-ia/
├── api/                  # Lógica del backend
├── data/                 # Datos de uso de la API
├── public/               # Archivos estáticos
├── src/                  # Código fuente frontend
│   ├── components/       # Componentes reutilizables
│   ├── context/          # Contextos de React
│   ├── hooks/            # Hooks personalizados
│   ├── pages/            # Páginas de la aplicación
│   ├── services/         # Servicios para API
│   └── utils/            # Utilidades
├── server.js             # Punto de entrada del servidor
└── vite.config.js        # Configuración de Vite
```

## 🧪 Flujo de desarrollo

Este proyecto sigue un modelo de ramificación basado en [Gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow):

- `main`: Rama de producción
- `develop`: Rama de desarrollo principal
- `feature/*`: Ramas para nuevas características
- `bugfix/*`: Ramas para corrección de errores
- `release/*`: Ramas de preparación de lanzamiento
- `hotfix/*`: Ramas para correcciones urgentes en producción

## 📝 Contribución

1. Haz un fork del proyecto
2. Crea tu rama de característica (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'feat: add amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.