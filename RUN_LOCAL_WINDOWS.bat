@echo off
cd /d "%~dp0"
echo Starting Paynet Loyalty...
echo.
if not exist node_modules\vite\bin\vite.js (
  echo Missing Vite in node_modules.
  echo Run: npm install --include=dev
  pause
  exit /b 1
)
npm run dev
pause
