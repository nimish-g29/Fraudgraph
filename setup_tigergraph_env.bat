@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example
) else (
  echo .env already exists
)

echo Opening .env for editing...
notepad ".env"
echo.
echo After saving .env, restart backend:
echo   .\start_backend.bat
echo.
pause

