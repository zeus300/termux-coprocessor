@echo off
chcp 65001 >nul
title Monitor y Failover Automatico: Postgres Termux ^<-^> Windows 11
color 0A

:: Asegurar directorio de trabajo
cd /d "%~dp0"

echo ======================================================================
echo    GESTOR INTELIGENTE DE COMPUTO: TERMUX (MOVIL) ^<-^> WINDOWS 11
echo ======================================================================
echo.
echo [*] Iniciando servidor ADB y monitor en segundo plano...

:: Iniciar servidor ADB silenciosamente si no estaba activo
where adb >nul 2>&1
if %errorlevel% equ 0 (
    start /B "" adb start-server >nul 2>&1
) else (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        start /B "" "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" start-server >nul 2>&1
    )
)

:: Lanzar el demonio de cluster y failover en tiempo real
node cluster-manager.js

echo.
pause
