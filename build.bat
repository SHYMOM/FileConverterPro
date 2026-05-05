@echo off
echo ========================================
echo   PDF Converter Pro - Build Script
echo ========================================

echo.
echo [1/3] Installing dependencies...
call npm install --legacy-peer-deps

echo.
echo [2/3] Building source files...
call npm run build

echo.
echo [3/3] Generating Windows Executable...
call npm run dist

echo.
echo ========================================
echo   Build Complete!
echo   Check the 'dist' folder for your EXE.
echo ========================================
pause
