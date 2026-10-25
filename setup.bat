@echo off
chcp 65001 >nul
title Asistente de Configuracion y Vinculacion - Termux Co-Processor
color 0B
cd /d "%~dp0"
node setup-wizard.js
pause
