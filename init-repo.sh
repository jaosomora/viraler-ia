#!/bin/bash
# Script para inicializar el repositorio Git y configurar las ramas principales

# Colores para la salida
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con formato
print_step() {
  echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

# Inicializar el repositorio si no existe
if [ ! -d .git ]; then
  print_step "Inicializando repositorio Git..."
  git init
  echo
fi

# Verificar si el README.md principal existe, si no, renombrar GITHUB_README.md
if [ ! -f README.md ] && [ -f GITHUB_README.md ]; then
  print_step "Configurando README.md principal..."
  mv GITHUB_README.md README.md
  echo
fi

# Agregar todos los archivos
print_step "Agregando archivos al stage..."
git add .
echo

# Hacer el commit inicial
print_step "Realizando commit inicial..."
git commit -m "chore: Commit inicial del proyecto Viraler IA"
echo

# Crear la rama develop
print_step "Creando rama develop..."
git checkout -b develop
echo

# Volver a la rama main
print_step "Volviendo a la rama main..."
git checkout main
echo

# Instrucciones para GitHub
print_step "Para subir a GitHub, ejecuta los siguientes comandos:"
echo -e "${GREEN}1. Crea un nuevo repositorio en GitHub (sin README, .gitignore o LICENSE)${NC}"
echo -e "${GREEN}2. Conecta tu repositorio local:${NC}"
echo "   git remote add origin https://github.com/tu-usuario/viraler-ia.git"
echo -e "${GREEN}3. Sube la rama main:${NC}"
echo "   git push -u origin main"
echo -e "${GREEN}4. Sube la rama develop:${NC}"
echo "   git checkout develop"
echo "   git push -u origin develop"
echo
print_step "¡Listo! Tu repositorio está configurado con las ramas main y develop."
