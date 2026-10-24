@echo off
title Student Survival Kit
cd /d "%~dp0"
echo ========================================================
echo       Starting Student Survival Kit Web App
echo ========================================================
echo.
echo Opening browser at http://localhost:8080 ...
start "" "http://localhost:8080"
echo Starting Python backend server...
python server.py
pause
