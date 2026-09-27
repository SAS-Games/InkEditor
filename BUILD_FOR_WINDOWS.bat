@echo off
REM Uses: https://github.com/electron-userland/electron-packager
REM To install it globally:
REM
REM     npm install electron-packager -g
REM

cd /d "%~dp0"
call npm install
call npm run build -- win64
