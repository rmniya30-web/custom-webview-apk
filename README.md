# SignageKiosk - Android WebView Kiosk App

A lightweight, open-source Android WebView kiosk application for digital signage.

## Features

- **True Fullscreen** - No status bar, navigation bar, or browser controls
- **No Video Controls** - Suppresses all video play button overlays
- **Cursor Auto-Hide** - Hides cursor after 5 seconds of idle (for Android TV)
- **First-Launch Setup** - Configure player URL on first run
- **Auto-Start on Boot** - Optional, configurable in settings
- **Crash Recovery** - Automatically restarts on crash
- **Lightweight** - Minimal dependencies, low memory footprint

## Build

### Requirements
- Android Studio or Gradle CLI
- JDK 17+

### Debug Build
```bash
cd android-kiosk
./gradlew assembleDebug
```
APK output: `app/build/outputs/apk/debug/app-debug.apk`

### Release Build
```bash
./gradlew assembleRelease
```

## Install on TV

### Simple Method (Recommended)
1. Copy `output/app-debug.apk` to a **USB drive**
2. Plug USB into your Android TV
3. Open **File Manager** on the TV
4. Find and click the APK file
5. Click **Install** when prompted
6. Done! The app appears in your app list

> **Note:** If prompted about "Unknown sources", go to TV Settings → Security → Enable "Unknown sources"

### Developer Method (via ADB)
```bash
adb connect <TV_IP>:5555
adb install output/app-debug.apk
```


## Settings

- **Player URL** - Edit the target URL
- **Auto-start on boot** - Toggle on/off
- **Clear cache** - Wipe WebView cache

## License

MIT License - See [LICENSE](LICENSE)
"# custom-webview-apk" 
