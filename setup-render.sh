#!/bin/bash
# Script para configurar el entorno en Render

echo "Configurando el entorno para Viraler IA en Render..."

# Crear directorio para datos persistentes
mkdir -p /opt/data
chmod 777 /opt/data

# Actualizar repositorios
echo "Actualizando repositorios..."
apt-get update

# Instalar FFmpeg
echo "Instalando FFmpeg..."
apt-get install -y ffmpeg

# Verificar instalación de FFmpeg
ffmpeg -version

# Instalar dependencias para yt-dlp
echo "Instalando dependencias para yt-dlp..."
apt-get install -y python3 python3-pip curl

# Instalar yt-dlp
echo "Instalando yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Verificar instalación de yt-dlp
yt-dlp --version

# Instalar dependencias de Node incluyendo las de desarrollo
echo "Instalando dependencias de Node..."
npm install --production=false

# Construir la aplicación
echo "Construyendo la aplicación..."
npm run build

echo "Configuración completada."
