# Script para reconectar o verificar el forward de puertos ADB
Write-Host "Verificando dispositivos ADB..." -ForegroundColor Cyan
adb devices

Write-Host "`nAplicando redirección: localhost:5432 -> Termux:5432..." -ForegroundColor Cyan
adb forward tcp:5432 tcp:5432

Write-Host "`nLista de puertos mapeados activos:" -ForegroundColor Yellow
adb forward --list
