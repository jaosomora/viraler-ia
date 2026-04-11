FROM node:22-slim

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

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar todas las dependencias (incluye devDeps para build)
RUN npm ci

# Copiar código fuente
COPY vite.config.js tailwind.config.js postcss.config.js ./
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Construir la aplicación
RUN npm run build

# Eliminar devDependencies después del build
RUN npm prune --omit=dev

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
