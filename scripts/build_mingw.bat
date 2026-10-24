@echo off
REM ============================================================================
REM Student Survival Kit (SSK) - Build Script for Windows (MinGW-w64 / GCC)
REM ============================================================================

echo ========================================================
echo    Building Student Survival Kit using CMake and MinGW-w64
echo ========================================================

REM Create build directory
if not exist build (
    mkdir build
)

cd build

REM Configure project with CMake using MinGW Makefiles
echo [1/3] Configuring CMake project for MinGW...
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] CMake configuration failed. Ensure gcc/g++ (version 9+) and cmake are in your PATH.
    exit /b %ERRORLEVEL%
)

REM Build binary
echo [2/3] Compiling student_survival_kit...
cmake --build . -j 4

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Compilation failed.
    exit /b %ERRORLEVEL%
)

echo [3/3] Build completed successfully!
echo Executable is located at: build\student_survival_kit.exe
echo.
echo To run the server:
echo   student_survival_kit.exe
echo.
pause
