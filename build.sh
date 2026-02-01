#!/bin/bash
# Build APK using Docker (Linux/Mac)

echo "Building Android APK with Docker..."

docker build -t signage-kiosk-builder .
if [ $? -ne 0 ]; then
    echo "Docker build failed!"
    exit 1
fi

mkdir -p output

docker run --rm -v "$(pwd)/output:/app/output" signage-kiosk-builder

echo ""
echo "Build complete!"
echo "APK location: output/app-debug.apk"
echo ""
echo "To install on TV:"
echo "  adb connect <TV_IP>:5555"
echo "  adb install output/app-debug.apk"
