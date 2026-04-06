@echo off
setlocal

REM Run from this script's directory
cd /d "%~dp0"

echo Starting FraudGraph backend on http://localhost:8000 ...
python -m uvicorn main:app --reload --port 8000

if errorlevel 1 (
  echo.
  echo Backend failed to start.
  echo If dependencies are missing, run: pip install -r requirements.txt
  echo.
  pause
)

