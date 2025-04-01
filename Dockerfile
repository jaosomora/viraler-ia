FROM node:18-slim

WORKDIR /app

# Instalar dependencias para FFmpeg y yt-dlp en una sola capa
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 python3-venv python3-dev python3-setuptools python3-wheel python3-pip curl ca-certificates && \
    pip3 install --no-cache-dir --break-system-packages pip setuptools wheel && \
    pip3 install --no-cache-dir --break-system-packages yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verificar instalación de yt-dlp
RUN yt-dlp --version

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