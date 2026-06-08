#!/bin/bash

# --- COLORES AUXILIARES ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YEL='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}      INSTALADOR AUTOMÁTICO - PROYECTOR CATÓLICO      ${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo ""

# 1. Verificar si Node.js está instalado
echo -e "${BLUE}[1/4] Verificando requisitos de sistema...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js no está instalado en este sistema.${NC}"
    echo -e "Por favor, descarga e instala Node.js LTS desde: https://nodejs.org/"
    exit 1
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}[OK] Node.js detectado: ${NODE_VERSION}${NC}"
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm no está instalado.${NC}"
    exit 1
else
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}[OK] npm detectado: ${NPM_VERSION}${NC}"
fi

# 2. Configuración de variables de entorno (.env)
echo ""
echo -e "${BLUE}[2/4] Configurando variables de entorno...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}[OK] Archivo de configuración .env creado a partir de .env.example${NC}"
    else
        touch .env
        echo -e "${GREEN}[OK] Archivo .env limpio creado.${NC}"
    fi
else
    echo -e "${YEL}[!] El archivo .env ya existe. Omitiendo creación...${NC}"
fi

# 3. Instalación de dependencias de Node
echo ""
echo -e "${BLUE}[3/4] Instalando dependencias del proyecto (npm install)...${NC}"
echo -e "${YEL}Esto puede tomar un momento dependiendo de tu conexión a internet...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] ¡Dependencias instaladas con éxito!${NC}"
else
    echo -e "${RED}[ERROR] Ocurrió un error al instalar las dependencias de npm.${NC}"
    exit 1
fi

# 4. Finalización y arranque
echo ""
echo -e "${BLUE}[4/4] Instalación completada con éxito.${NC}"
echo -e "-----------------------------------------------------"
echo -e "Para iniciar el proyector tienes dos opciones:"
echo -e "1) Modo Desarrollo (Recomendado para cambios en tiempo real): ${GREEN}npm run dev${NC}"
echo -e "2) Modo Producción (Más rápido y optimizado): ${GREEN}npm run build && npm start${NC}"
echo -e "-----------------------------------------------------"
echo ""

read -p "¿Deseas iniciar el servidor de desarrollo ahora mismo? (s/n): " answer
if [[ "$answer" =~ ^[Ss]$ ]]; then
    echo -e "${GREEN}Iniciando servidor de desarrollo...${NC}"
    npm run dev
else
    echo -e "${BLUE}¡Instalación completada! Puedes cerrar esta ventana e iniciar el proyector cuando gustes.${NC}"
fi
