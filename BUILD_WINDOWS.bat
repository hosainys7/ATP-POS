@echo off
setlocal
cd /d "%~dp0"
echo Construction de la version locale du POS...
call pnpm --dir frontend build
if errorlevel 1 (
  echo [ERREUR] La construction a echoue.
  pause
  exit /b 1
)
echo.
echo Version mise a jour avec succes.
pause
