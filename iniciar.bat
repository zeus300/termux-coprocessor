@echo off
chcp 65001 >nul
title Termux Co-Processor & Database Engine
color 0A

:: Asegurar directorio de trabajo
cd /d "%~dp0"

echo ======================================================================
echo    TERMUX ARM64 CO-PROCESSOR ^& DATABASE OFFLOADING ENGINE
echo    Diseñado por: Marcos Bazán (Open Source Community Edition)
echo ======================================================================
echo.

:: Verificar si Node.js está disponible
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] ERROR: Node.js no está instalado en Windows.
    echo     Por favor instala Node.js desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Verificar si hay dispositivos ADB activos
for /f "tokens=*" %%i in ('adb devices 2^>nul ^| findstr /r /c:"[a-zA-Z0-9].*device$"') do set ADB_DEVICE=%%i

if "%ADB_DEVICE%"=="" (
    echo [*] No se detectó un smartphone listo o es tu primera vez ejecutando.
    echo [*] Abriendo el Asistente Interactivo de Configuración (Setup Wizard)...
    echo.
    node setup-wizard.js
) else (
    echo [✔] Smartphone detectado y enlazado.
    echo [*] Iniciando servidor ADB y Monitor de Cómputo con Failover en tiempo real...
    echo.
    node cluster-manager.js
)

echo.
pause
