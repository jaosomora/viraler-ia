FROM node:22-slim

WORKDIR /app

# Instalar dependencias del sistema (FFmpeg, yt-dlp, build tools para sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 python3-venv python3-dev python3-setuptools python3-wheel python3-pip curl ca-certificates build-essential && \
    pip3 install --no-cache-dir --break-system-packages pip setuptools wheel && \
    pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp 'markitdown[all]' pymupdf4llm && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# yt-dlp tiene releases muy frecuentes (semanales/diarias) por cambios constantes en YouTube/Facebook/Instagram/TikTok.
# Esta línea fuerza re-upgrade en cada build con --break-system-packages (separada de la layer anterior para
# que Docker la re-ejecute aunque la primera esté cacheada). Cambiar este ARG fuerza cache miss del upgrade.
ARG YT_DLP_CACHE_BUST=2026-05-11
RUN pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp

# Verificar instalaciones
RUN yt-dlp --version && markitdown --help > /dev/null 2>&1 && python3 -c "import pymupdf4llm"

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar todas las dependencias y recompilar sqlite3 desde source
RUN npm ci --build-from-source

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
COPY scripts/ ./scripts/

# Copiar fuentes para AS Clips (libass las usa vía --fontsdir en burn-in de subs).
# Sin esto, ffmpeg cae al fallback sans-serif y el hook pierde la fuente Anton.
COPY assets/ ./assets/

# Crear directorio para cookies y datos
RUN mkdir -p /app/config /opt/data && chmod 777 /opt/data /app/config

# Configurar entorno
ENV PORT=10000
ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV MARKITDOWN_PATH=/usr/local/bin/markitdown

# Comando de inicio
CMD ["node", "server.js"]
