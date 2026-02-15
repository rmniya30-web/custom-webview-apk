#!/bin/bash
# ── Build APK via Docker ──────────────────────────────────
# Usage: ./build.sh <SOCKET_URL> [DISCORD_WEBHOOK_URL]
#
# Example:
#   ./build.sh https://signage.example.com https://discord.com/api/webhooks/xxx/yyy

set -e

SOCKET_URL="${1:?Usage: ./build.sh <SOCKET_URL> [DISCORD_WEBHOOK_URL]}"
DISCORD_WEBHOOK="${2:-}"

echo "[1/3] Building Docker image..."
docker build \
    --build-arg SOCKET_URL="$SOCKET_URL" \
    --build-arg DISCORD_WEBHOOK_URL="$DISCORD_WEBHOOK" \
    --build-arg MAX_CACHE_MB=200 \
    -t signage-player .

echo "[2/3] Extracting APK..."
docker create --name signage-tmp signage-player > /dev/null 2>&1 || true
docker cp signage-tmp:/output/signage-player.apk ./signage-player.apk
docker rm signage-tmp > /dev/null 2>&1 || true

if [ -f signage-player.apk ]; then
    echo "[3/3] Done! APK: signage-player.apk ($(du -h signage-player.apk | cut -f1))"
else
    echo "Failed to extract APK"
    exit 1
fi
