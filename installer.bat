@echo off
title Instalador - Proyector Catolico
color 0B
clear
cls

echo =====================================================
echo       INSTALADOR AUTOMATICO - PROYECTOR CATOLICO
echo =====================================================
echo.

:: 1. Verificar si Node.js está instalado
echo [1/4] Verificando requisitos de sistema...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no esta instalado en este sistema.
    echo Por favor, descarga e instala Node.js LTS desde: https://nodejs.org/
    echo.
    pause
    exit /b
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo OK - Node.js detectado: %NODE_VER%
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] npm no esta instalado correctamente en este sistema.
    pause
    exit /b
) else (
    for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
    echo OK - npm detectado: %NPM_VER%
)

:: 2. Configuración de variables de entorno (.env)
echo.
echo [2/4] Configurando variables de entorno...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo OK - Archivo de configuracion .env creado a partir de .env.example
    ) else (
        echo. > .env
        echo OK - Archivo .env vacio creado.
    )
) else (
    echo NOTA: El archivo .env ya existe. Omitiendo creacion...
)

:: 3. Instalación de dependencias de Node
echo.
echo [3/4] Instalando dependencias del proyecto (npm install)...
echo Esto puede tomar un momento dependiendo de tu conexion a internet...
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Ocurrio un error al instalar las dependencias de npm.
    pause
    exit /b
) else (
    echo OK - ¡Dependencias instaladas con exito!
)

:: 4. Finalización y arranque
echo.
echo [4/4] Instalacion completada con exito.
echo -----------------------------------------------------
echo Para iniciar el proyector tienes dos opciones:
echo.
echo 1) Modo Desarrollo: npm run dev
echo 2) Modo Produccion (Compilado): npm run build ^&^& npm start
echo -----------------------------------------------------
echo.

set /p answer="¿Deseas iniciar el servidor de desarrollo ahora mismo? (s/n): "
if /i "%answer%"=="s" (
    echo.
    echo Iniciando servidor de desarrollo...
    color 0A
    npm run dev
) else (
    echo.
    echo ¡Instalacion completada! Puedes iniciar el proyector cuando gustes ejecutando de forma manual "npm run dev".
    pause
)
