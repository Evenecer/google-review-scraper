@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :install_fail
)
cls
echo Starting app...
node scraper.js

echo.
echo (App exited with code %errorlevel%)
pause
exit /b

:install_fail
echo Install failed.
pause
exit /b 1

