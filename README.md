# Signage Player — React Native Android

Native Android application for digital signage displays. Built with React Native + ExoPlayer for hardware-accelerated H.264 video playback on low-end devices.

## Features

- **Native Video Playback** — ExoPlayer with hardware H.264 decoding (no WebView)
- **Gapless Loop** — Dual-player preloading for seamless video transitions
- **Socket.IO** — Real-time communication with SignageOS dashboard
- **File-Based Cache** — Videos cached to filesystem with LRU eviction (200MB default)
- **Kiosk Mode** — Fullscreen, no status bar, auto-start on boot
- **Low-End Optimized** — Hermes JS engine, ProGuard R8, minimal memory footprint
- **Self-Healing** — Watchdog recovery, 2-hour session refresh, 3AM daily reset
- **Discord Logging** — Crash/event reporting via webhook

## Architecture

```
App.tsx (State Machine)
├── PairingScreen  — Shows 6-digit code for dashboard pairing
├── PlayerScreen   — Dual-player video with caching + watchdog
└── SleepScreen    — Black screen (hibernate/empty playlist)

Services:
├── SocketService  — Socket.IO client (auth, heartbeat, reconnect)
├── CacheService   — File-based video cache with LRU eviction
└── DiscordLogger  — Throttled webhook logging
```

## Build (Docker CI/CD)

### Prerequisites
- Docker installed on your CI server

### Option 1: Build Script

```bash
# Linux/Mac
./build.sh https://your-signage-server.com https://discord.com/api/webhooks/xxx/yyy

# Windows
build.bat https://your-signage-server.com https://discord.com/api/webhooks/xxx/yyy
```

APK output: `./signage-player.apk`

### Option 2: Docker Compose

```bash
# Set env vars
export SOCKET_URL=https://your-signage-server.com
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy

# Build and export APK
mkdir -p output
docker compose up --build
```

APK output: `./output/signage-player.apk`

### Option 3: Manual Docker

```bash
# 1. Build the image
docker build \
  --build-arg SOCKET_URL=https://your-signage-server.com \
  --build-arg DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy \
  --build-arg MAX_CACHE_MB=200 \
  -t signage-player .

# 2. Extract APK from image
docker create --name tmp signage-player
docker cp tmp:/output/signage-player.apk ./signage-player.apk
docker rm tmp
```

### Build Arguments

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `SOCKET_URL` | **Yes** | `http://localhost:3001` | Socket.IO server URL |
| `DISCORD_WEBHOOK_URL` | No | _(empty)_ | Discord webhook for crash logging |
| `MAX_CACHE_MB` | No | `200` | Max video cache size in MB |

## Install on Device

### USB Method
1. Copy `signage-player.apk` to USB drive
2. Plug into Android TV
3. Open File Manager → Install APK
4. Enable "Unknown sources" if prompted

### ADB Method
```bash
adb connect <DEVICE_IP>:5555
adb install signage-player.apk
```

## How It Works

1. **First Launch** → App shows 6-digit pairing code
2. **Pair from Dashboard** → Go to Dashboard > Screens > Add Screen, enter code
3. **Playlist Cast** → Dashboard sends playlist via Socket.IO → videos play in loop
4. **Caching** → Videos download to local storage for instant replay
5. **Self-Healing** → Watchdog detects stuck playback, session refreshes every 2 hours
6. **Schedule** → Server can hibernate/wake devices on schedule

## License

MIT License — See [LICENSE](LICENSE)
