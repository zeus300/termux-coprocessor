@echo off
title Test Co-Procesador Movil Termux ARM64
echo ==============================================================
echo   PROBANDO COMPUTO EN EL PROCESADOR ARM DEL MOTO G(9) PLAY
echo ==============================================================
echo.
node "%~dp0termux-exec.js" "%~dp0test-arm.js"
echo.
pause
