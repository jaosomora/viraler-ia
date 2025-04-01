FROM node:18-slim

WORKDIR /app

# Instalar dependencias para FFmpeg y yt-dlp en una sola capa
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3-minimal curl ca-certificates && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar solo archivos de dependencias primero
COPY package.json package-lock.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Copiar archivos de configuración de build
COPY vite.config.js tailwind.config.js postcss.config.js ./

# Copiar código fuente
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Instalar dependencias de desarrollo (solo para build)
RUN npm install --no-save vite @vitejs/plugin-react postcss autoprefixer tailwindcss

# Construir la aplicación
RUN npm run build

# Copiar archivos de servidor
COPY server.js ./
COPY api/ ./api/

# Configurar entorno
ENV PORT=10000
ENV NODE_ENV=production

# Directorio para datos
RUN mkdir -p /opt/data && chmod 777 /opt/data

# Comando de inicio
CMD ["node", "server.js"]