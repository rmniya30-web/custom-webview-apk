# ───────────────────────────────────────────────────────────────
# Dockerfile — Build React Native Android APK in CI/CD
#
# Usage:
#   docker build \
#     --build-arg SOCKET_URL=https://your-server.com \
#     --build-arg DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... \
#     --build-arg MAX_CACHE_MB=200 \
#     -t signage-player .
#
#   # Extract APK from container:
#   docker create --name tmp signage-player
#   docker cp tmp:/output/signage-player.apk ./signage-player.apk
#   docker rm tmp
# ───────────────────────────────────────────────────────────────

FROM reactnativecommunity/react-native-android:13.0 AS builder

# Build-time args → baked into .env at build time
ARG SOCKET_URL=http://localhost:3001
ARG DISCORD_WEBHOOK_URL=
ARG MAX_CACHE_MB=200

WORKDIR /app

# ── Step 1: Initialize React Native project ──────────────────
# Using @react-native-community/cli to scaffold the Android project structure
RUN npx -y @react-native-community/cli@latest init SignagePlayer \
    --package-name com.signageplayer \
    --pm npm \
    --skip-git-init \
    --skip-install \
    2>/dev/null || true

WORKDIR /app/SignagePlayer

# ── Step 2: Copy our package.json and install deps ────────────
COPY package.json ./package.json.custom

# Merge our dependencies into the generated package.json
RUN node -e " \
  const gen = JSON.parse(require('fs').readFileSync('package.json','utf8')); \
  const custom = JSON.parse(require('fs').readFileSync('package.json.custom','utf8')); \
  Object.assign(gen.dependencies, custom.dependencies); \
  Object.assign(gen.devDependencies || {}, custom.devDependencies || {}); \
  gen.scripts = { ...gen.scripts, ...custom.scripts }; \
  require('fs').writeFileSync('package.json', JSON.stringify(gen, null, 2)); \
" && rm package.json.custom

RUN npm install --legacy-peer-deps

# ── Step 3: Copy our source files (overlay generated ones) ────
COPY index.js .
COPY app.json .
COPY babel.config.js .
COPY metro.config.js .
COPY tsconfig.json .
COPY src/ src/

# ── Step 4: Generate .env from build args ─────────────────────
RUN echo "SOCKET_URL=${SOCKET_URL}" > .env && \
    echo "DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}" >> .env && \
    echo "MAX_CACHE_MB=${MAX_CACHE_MB}" >> .env

# ── Step 5: Apply Android patches ────────────────────────────
COPY patches/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
COPY patches/strings.xml android/app/src/main/res/values/strings.xml
COPY patches/styles.xml android/app/src/main/res/values/styles.xml

# Copy BootReceiver to the correct package directory
RUN mkdir -p android/app/src/main/java/com/signageplayer
COPY patches/BootReceiver.java android/app/src/main/java/com/signageplayer/BootReceiver.java

# ── Step 6: Configure Gradle for optimized release build ──────
# Enable Hermes, ProGuard, and set signing to debug key for now
RUN cd android && \
    # Ensure gradle.properties has the right settings
    echo "" >> gradle.properties && \
    echo "# Optimizations for low-end devices" >> gradle.properties && \
    echo "org.gradle.jvmargs=-Xmx4096m" >> gradle.properties && \
    echo "android.enableR8.fullMode=true" >> gradle.properties

# ── Step 7: Create JS bundle (offline) ────────────────────────
RUN npx react-native bundle \
    --platform android \
    --dev false \
    --entry-file index.js \
    --bundle-output android/app/src/main/assets/index.android.bundle \
    --assets-dest android/app/src/main/res

# ── Step 8: Build APK ────────────────────────────────────────
RUN cd android && ./gradlew assembleRelease --no-daemon -x lint

# ── Step 9: Copy APK to /output ──────────────────────────────
RUN mkdir -p /output && \
    cp android/app/build/outputs/apk/release/app-release.apk /output/signage-player.apk 2>/dev/null || \
    cp android/app/build/outputs/apk/release/app-release-unsigned.apk /output/signage-player.apk 2>/dev/null || \
    cp android/app/build/outputs/apk/debug/app-debug.apk /output/signage-player.apk 2>/dev/null || \
    echo "APK not found in expected locations"

# ── Final: Minimal output image ──────────────────────────────
FROM alpine:latest
COPY --from=builder /output/signage-player.apk /output/signage-player.apk
CMD ["echo", "APK is at /output/signage-player.apk — use 'docker cp' to extract it"]
