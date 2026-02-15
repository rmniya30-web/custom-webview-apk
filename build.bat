@echo off
REM ── Build APK via Docker ──────────────────────────────────
REM Usage: build.bat [SOCKET_URL] [DISCORD_WEBHOOK_URL]
REM
REM Example:
REM   build.bat https://signage.example.com https://discord.com/api/webhooks/xxx/yyy

set SOCKET_URL=%1
set DISCORD_WEBHOOK=%2

if "%SOCKET_URL%"=="" (
    echo Usage: build.bat ^<SOCKET_URL^> [DISCORD_WEBHOOK_URL]
    echo Example: build.bat https://signage.example.com
    exit /b 1
)

echo [1/3] Building Docker image...
docker build ^
    --build-arg SOCKET_URL=%SOCKET_URL% ^
    --build-arg DISCORD_WEBHOOK_URL=%DISCORD_WEBHOOK% ^
    --build-arg MAX_CACHE_MB=200 ^
    -t signage-player .

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    exit /b 1
)

echo [2/3] Extracting APK...
docker create --name signage-tmp signage-player >nul 2>&1
docker cp signage-tmp:/output/signage-player.apk ./signage-player.apk
docker rm signage-tmp >nul 2>&1

if exist signage-player.apk (
    echo [3/3] Done! APK: signage-player.apk
) else (
    echo Failed to extract APK
    exit /b 1
)
