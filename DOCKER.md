# Guía Docker para Viraler IA

Esta guía detalla cómo configurar y usar Docker con Viraler IA para desarrollo local y despliegue en producción.

## Índice

- [Configuración inicial](#configuración-inicial)
- [Entorno de desarrollo](#entorno-de-desarrollo)
- [Entorno de producción](#entorno-de-producción)
- [Gestión de datos](#gestión-de-datos)
- [Variables de entorno](#variables-de-entorno)
- [Solución de problemas](#solución-de-problemas)
- [Mejores prácticas](#mejores-prácticas)

## Configuración inicial

### Requisitos previos

- Docker Desktop instalado ([Descargar aquí](https://www.docker.com/products/docker-desktop/))
- Docker Compose instalado (incluido con Docker Desktop)
- Git para clonar el repositorio

### Estructura de archivos Docker

El proyecto incluye los siguientes archivos para Docker:

- `Dockerfile.dev` - Configuración para desarrollo local
- `Dockerfile` - Configuración para producción
- `docker-compose.yml` - Orquestación de servicios para desarrollo
- `.dockerignore` - Archivos excluidos del contexto de construcción

## Entorno de desarrollo

El entorno de desarrollo está configurado para proporcionar hot-reload y un flujo de trabajo eficiente.

### Comandos disponibles

Estos comandos están definidos en `package.json`:

```bash
# Construir la imagen Docker
npm run docker:build

# Iniciar contenedores en primer plano
npm run docker:start

# Iniciar contenedores en segundo plano
npm run docker:start:detached

# Ver logs
npm run docker:logs

# Entrar al shell del contenedor
npm run docker:bash

# Detener contenedores
npm run docker:stop
```

### Volúmenes montados

El archivo `docker-compose.yml` configura estos volúmenes:

- `.:/app` - Monta el código fuente para desarrollo en tiempo real
- `/app/node_modules` - Preserva los node_modules del contenedor
- `./data:/opt/data` - Persistencia de datos entre sesiones
- `./config:/app/config` - Configuraciones como cookies de Instagram

### Puertos expuestos

- `5173` - Servidor Vite (frontend)
- `3000` - Servidor Express (backend)

## Entorno de producción

La configuración de producción está optimizada para rendimiento y seguridad.

### Dockerfile de producción

El archivo `Dockerfile` está optimizado para producción:

- Usa multistage building para reducir tamaño
- Instala solo dependencias de producción
- Precompila activos estáticos
- Optimizado para minimizar cold starts

### Despliegue en Render

Para desplegar en Render con Docker:

1. Configura el servicio como "Docker"
2. Configura variables de entorno:
   - `OPENAI_API_KEY`
   - `NODE_ENV=production`
   - `FFMPEG_PATH=/usr/bin/ffmpeg`
   - `INSTAGRAM_COOKIES` (opcional, con contenido del archivo de cookies)
3. Configura un disco persistente:
   - Mount path: `/opt/data`
   - Tamaño: 1 GB o más

## Gestión de datos

### Persistencia de datos

En Docker, los datos se gestionan a través de volúmenes montados:

- **Desarrollo**: Utiliza la carpeta local `./data` montada en `/opt/data`
- **Producción (Render)**: Utiliza un disco persistente montado en `/opt/data`

### Gestión de cookies para Instagram

Para acceder a contenido restringido de Instagram:

1. Coloca el archivo de cookies en `config/instagram_cookies.txt`
2. El archivo se montará automáticamente en el contenedor
3. La aplicación lo utilizará cuando sea necesario

En producción (Render):
1. Configura el contenido del archivo de cookies como variable de entorno `INSTAGRAM_COOKIES`
2. La aplicación creará automáticamente el archivo de cookies en el contenedor

## Variables de entorno

Docker utiliza estas variables:

### Variables requeridas

- `OPENAI_API_KEY` - Tu clave API de OpenAI

### Variables opcionales

- `NODE_ENV` - `development` (default) o `production`
- `FFMPEG_PATH` - Ruta a FFmpeg (por defecto `/usr/bin/ffmpeg` en Docker)
- `PORT` - Puerto para el servidor Express (por defecto `3000`)
- `VITE_HOST` - Host para Vite (en desarrollo)
- `INSTAGRAM_COOKIES` - Contenido del archivo de cookies en producción

## Solución de problemas

### Problemas comunes

1. **Imagen no se construye**
   - Ejecuta `docker system prune` para limpiar recursos no utilizados
   - Verifica permisos de archivos y carpetas

2. **Hot reload no funciona**
   - Asegúrate que `CHOKIDAR_USEPOLLING=true` esté configurado
   - Verifica que el volumen `.:/app` esté correctamente montado

3. **FFmpeg o yt-dlp no se encuentran**
   - Verifica los logs: `npm run docker:logs`
   - Entra al contenedor y verifica instalación: `npm run docker:bash` luego `ffmpeg -version` y `yt-dlp --version`

4. **No se puede acceder a la aplicación**
   - Asegúrate de estar usando URLs con `localhost`, no `0.0.0.0`
   - Verifica que los puertos no estén siendo usados por otras aplicaciones

## Mejores prácticas

### Seguridad

- No incluyas secretos en imágenes Docker (usa variables de entorno)
- No ejecutes contenedores como root en producción
- Actualiza imágenes base regularmente

### Optimización

- El `Dockerfile` está configurado para construir en capas eficientes
- Minimizar el tamaño de la imagen final
- Uso de cachés de construcción efectivos

### CI/CD

Para integrar con CI/CD:

1. Agrega pruebas automatizadas
2. Configura build automatizados con GitHub Actions
3. Implementa despliegue continuo a Render

## Comandos Docker útiles

```bash
# Ver contenedores en ejecución
docker ps

# Ver logs de un contenedor específico
docker logs viraler-ia-container

# Eliminar todas las imágenes y contenedores no utilizados
docker system prune -a

# Construir sin usar caché
docker-compose build --no-cache

# Verificar uso de recursos
docker stats
```

---

Esta documentación debe ayudarte a aprovechar al máximo la configuración Docker para Viraler IA. Si encuentras problemas o tienes mejoras, por favor contribuye al proyecto.
