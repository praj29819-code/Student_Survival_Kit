@echo off
REM ============================================================================
REM Student Survival Kit (SSK) - Build Script for Windows (Visual Studio / MSVC)
REM ============================================================================

echo ========================================================
echo    Building Student Survival Kit using CMake and MSVC
echo ========================================================

REM Create build directory
if not exist build (
    mkdir build
)

cd build

REM Configure project with CMake
echo [1/3] Configuring CMake project...
cmake .. -G "Visual Studio 17 2022" -A x64

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] CMake configuration failed. Ensure CMake and Visual Studio 2022 C++ are installed.
    exit /b %ERRORLEVEL%
)

REM Build release binary
echo [2/3] Building student_survival_kit executable (Release)...
cmake --build . --config Release

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed.
    exit /b %ERRORLEVEL%
)

echo [3/3] Build completed successfully!
echo Executable is located at: build\Release\student_survival_kit.exe
echo.
echo To run the server:
echo   cd Release
echo   student_survival_kit.exe
echo.
pause
