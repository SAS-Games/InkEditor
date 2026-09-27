@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or is not available on PATH.
  echo Install Node.js 22.12 or newer from https://nodejs.org/ and run this file again.
  exit /b 1
)

call npm install
if errorlevel 1 exit /b %errorlevel%

call npm start
