@echo off
title Mobile Hub System Launcher
echo =========================================
echo      STARTING MOBILE HUB POS SYSTEM
echo =========================================
echo.

:: 1. Start MongoDB silently in the background
echo [1/3] Starting MongoDB...
start "" "mongod" --quiet

:: 2. Start Backend Server silently in the background
echo [2/3] Starting Backend API...
start "" cmd /k "cd /d D:\Mobile-Inventory\mobile-hub-backend && node server.js"

:: 3. Wait 4 seconds for the database and server to wake up
echo Waiting for database connection...
timeout /t 4 /nobreak >nul

:: 4. Start the Frontend Desktop App
echo [3/3] Launching Desktop Application...
start "" cmd /k "cd /d D:\Mobile-Inventory\mobile-hub-desktop && npm run electron:dev"

echo.
echo System is launching! You can close this window.
timeout /t 3 /nobreak >nul
exit