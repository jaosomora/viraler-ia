#!/bin/bash
# scripts/get-instagram-cookies.sh

echo "=== Extractor de Cookies de Instagram ==="
echo ""
echo "Asegúrate de estar logueado en Instagram en tu navegador Chrome"
echo ""

# Crear directorio config si no existe
mkdir -p config

# Extraer cookies usando yt-dlp (el error al final es esperado)
echo "Extrayendo cookies desde Chrome..."
yt-dlp --cookies-from-browser chrome --cookies config/instagram_cookies.txt --skip-download https://www.instagram.com 2>/dev/null || true

# Verificar si el archivo se creó y tiene contenido
if [ -f "config/instagram_cookies.txt" ] && [ -s "config/instagram_cookies.txt" ]; then
    FILE_SIZE=$(ls -lh config/instagram_cookies.txt | awk '{print $5}')
    echo "✅ Cookies extraídas exitosamente!"
    echo "   Archivo: config/instagram_cookies.txt"
    echo "   Tamaño: $FILE_SIZE"
    echo ""
    echo "Las cookies están listas para usar."
else
    echo "❌ No se pudieron extraer las cookies."
    echo "   Verifica que estés logueado en Instagram en Chrome."
fi