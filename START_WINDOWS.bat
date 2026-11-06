@echo off
setlocal
cd /d "%~dp0"
title Atelier Trottinette Pro POS

echo ==============================================
echo   ATELIER TROTTINETTE PRO - POS
echo ==============================================
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] pnpm n'est pas installe sur ce PC.
  echo Installez Node.js et pnpm avant de continuer.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue; if($c){exit 10}else{exit 0}"
if errorlevel 10 (
  echo Le POS est deja lance. Ouverture dans le navigateur...
  start "" http://localhost:3001
  exit /b 0
)

if not exist "frontend\dist\index.html" (
  echo Preparation de l'interface pour la premiere utilisation...
  call pnpm --dir frontend build
  if errorlevel 1 (
    echo [ERREUR] Impossible de construire l'interface.
    pause
    exit /b 1
  )
)

echo Demarrage du POS...
start "ATP POS Server" /min cmd /c call "%~dp0scripts\run-backend.bat"

timeout /t 3 /nobreak >nul
start "" http://localhost:3001

echo.
echo Le POS est ouvert dans votre navigateur.
echo Utilisez STOP_WINDOWS.bat pour l'arreter proprement.
timeout /t 2 /nobreak >nul
exit /b 0
