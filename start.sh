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

# 3b. Verificar/generar clave de cifrado para Secretos
if [ -f ".env" ] && ! grep -q "^SECRETS_ENCRYPTION_KEY=." ".env"; then
  echo "Generando SECRETS_ENCRYPTION_KEY (necesaria para la herramienta Secretos)..."
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if grep -q "^SECRETS_ENCRYPTION_KEY=" ".env"; then
    # Reemplaza línea vacía existente
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^SECRETS_ENCRYPTION_KEY=.*|SECRETS_ENCRYPTION_KEY=$KEY|" .env
    else
      sed -i "s|^SECRETS_ENCRYPTION_KEY=.*|SECRETS_ENCRYPTION_KEY=$KEY|" .env
    fi
  else
    echo "SECRETS_ENCRYPTION_KEY=$KEY" >> .env
  fi
fi

# 4. Instalar dependencias del sistema si faltan
ensure_brew() {
  if ! command -v brew >/dev/null; then
    echo "ERROR: Homebrew no encontrado. Instálalo desde https://brew.sh y reintenta."
    exit 1
  fi
}

if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! command -v ffmpeg >/dev/null; then
    ensure_brew
    echo "Instalando ffmpeg..."
    brew install ffmpeg
  fi
  if ! command -v yt-dlp >/dev/null; then
    ensure_brew
    echo "Instalando yt-dlp..."
    brew install yt-dlp
  fi
  if ! command -v markitdown >/dev/null; then
    ensure_brew
    if ! command -v pipx >/dev/null; then
      echo "Instalando pipx..."
      brew install pipx
      pipx ensurepath >/dev/null 2>&1 || true
      export PATH="$HOME/.local/bin:$PATH"
    fi
    echo "Instalando markitdown..."
    pipx install 'markitdown[all]'
  fi
  # pymupdf4llm: usado por scripts/pdf_to_md.py (no viene con markitdown[all])
  if ! "$HOME/.local/pipx/venvs/markitdown/bin/python" -c "import pymupdf4llm" >/dev/null 2>&1; then
    echo "Inyectando pymupdf4llm en el venv de markitdown..."
    pipx inject markitdown pymupdf4llm
  fi
else
  command -v markitdown >/dev/null || echo "AVISO: markitdown no encontrado. Instala con: pipx install 'markitdown[all]'"
  command -v yt-dlp     >/dev/null || echo "AVISO: yt-dlp no encontrado."
  command -v ffmpeg     >/dev/null || echo "AVISO: ffmpeg no encontrado."
fi

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
