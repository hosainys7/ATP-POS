$ports = @(3001, 5173)
$stopped = $false

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
            Write-Host "Processus POS arrete sur le port $port." -ForegroundColor Green
            $stopped = $true
        } catch {
            Write-Host "Impossible d'arreter le processus sur le port $port." -ForegroundColor Red
        }
    }
}

if (-not $stopped) {
    Write-Host "Le POS n'etait pas en cours d'execution." -ForegroundColor Yellow
}

Start-Sleep -Seconds 1
