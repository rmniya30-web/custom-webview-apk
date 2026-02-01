@echo off
REM Build APK using Docker (Windows)

echo Building Android APK with Docker...

docker build -t signage-kiosk-builder .
if %ERRORLEVEL% neq 0 (
    echo Docker build failed!
    exit /b 1
)

if not exist "output" mkdir output

docker run --rm -v "%cd%\output:/app/output" signage-kiosk-builder

echo.
echo Build complete!
echo APK location: output\app-debug.apk
echo.
echo To install on TV:
echo   adb connect ^<TV_IP^>:5555
echo   adb install output\app-debug.apk
