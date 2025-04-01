FROM node:18-slim

WORKDIR /app

# Instalar dependencias para FFmpeg y yt-dlp
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verificar instalaciones
RUN ffmpeg -version && yt-dlp --version

# Copiar archivos de la aplicación
COPY . .

# Instalar dependencias de Node
RUN npm install

# Construir la aplicación
RUN npm run build

# Puerto por defecto
ENV PORT=10000

# Directorio para datos
RUN mkdir -p /opt/data && chmod 777 /opt/data

# Comando de inicio
CMD ["node", "server.js"]
