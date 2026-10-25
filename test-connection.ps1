# Script de prueba rápida de socket TCP para PostgreSQL (Port 5432)
$HostName = "127.0.0.1"
$Port = 5432

Write-Host "Verificando conexión TCP con $HostName en el puerto $Port (ADB forward)..." -ForegroundColor Cyan

try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connect = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
    
    if (-not $wait) {
        $tcpClient.Close()
        Write-Host " [ERROR] Timeout: El puerto $Port no respondió a tiempo." -ForegroundColor Red
        Write-Host "Verifica que PostgreSQL esté iniciado dentro de Termux ('pg_ctl -D `$PREFIX/var/lib/postgresql start')." -ForegroundColor Yellow
        exit 1
    }

    $tcpClient.EndConnect($connect)
    $tcpClient.Close()
    Write-Host " [EXITO] Socket TCP accesible en ${HostName}:${Port}. El redireccionamiento ADB funciona correctamente!" -ForegroundColor Green
} catch {
    Write-Host " [ERROR] Falló la conexión: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Asegúrate de haber ejecutado: adb forward tcp:5432 tcp:5432 y que PostgreSQL esté corriendo en Termux." -ForegroundColor Yellow
    exit 1
}
