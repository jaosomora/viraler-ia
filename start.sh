#!/usr/bin/env bash
# Levanta AS Tools en local (frontend + backend) y abre el navegador.
# Uso: ./start.sh

set -e

cd "$(dirname "$0")"

echo "AS Tools — iniciando entorno local"

# 1. Verificar dependencias del sistema
command -v node >/dev/null || { echo "ERROR: node no encontrado. Instala Node.js."; exit 1; }
command -v npm >/dev/null  || { echo "ERROR: npm no encontrado."; exit 1; }

# 2. Instalar paquetes si falta node_modules
if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias npm..."
  npm install
fi

# 3. Verificar .env
if [ ! -f ".env" ]; then
  echo "ADVERTENCIA: no existe .env — algunas funciones (transcripción, Claude API) no funcionarán."
  echo "Copia .env.example a .env y completa las API keys si las necesitas."
fi

# 4. Avisos opcionales
command -v markitdown >/dev/null || echo "AVISO: markitdown no encontrado (Convert no funcionará). Instala con: pipx install 'markitdown[all]'"
command -v yt-dlp     >/dev/null || echo "AVISO: yt-dlp no encontrado (Transcribe por URL no funcionará)."
command -v ffmpeg     >/dev/null || echo "AVISO: ffmpeg no encontrado (extracción de audio no funcionará)."

# 5. Abrir navegador cuando el server esté listo (macOS)
URL="http://localhost:5173"
(
  for i in {1..30}; do
    if curl -s -o /dev/null "$URL"; then
      open "$URL" 2>/dev/null || true
      exit 0
    fi
    sleep 1
  done
) &

# 6. Arrancar dev (frontend + backend). Ctrl+C corta ambos.
cat <<BANNER

============================================================
  AS Tools corriendo en local
  App:      http://localhost:5173
  API:      http://localhost:3000
  Detener:  Ctrl+C
============================================================

BANNER
npm run dev
