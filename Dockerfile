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

FROM reactnativecommunity/react-native-android:latest AS builder

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

# Gradle 9.0 removed jcenter() — replace with mavenCentral() in all deps
RUN find node_modules -name '*.gradle' -exec sed -i 's/jcenter()/mavenCentral()/g' {} +

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
# Copy TV banner
RUN mkdir -p android/app/src/main/res/drawable
COPY patches/banner.xml android/app/src/main/res/drawable/banner.xml

# Copy BootReceiver to the correct package directory
RUN mkdir -p android/app/src/main/java/com/signageplayer
COPY patches/BootReceiver.java android/app/src/main/java/com/signageplayer/BootReceiver.java
COPY patches/RestartModule.java android/app/src/main/java/com/signageplayer/RestartModule.java
COPY patches/RestartPackage.java android/app/src/main/java/com/signageplayer/RestartPackage.java

# Inject RestartPackage into MainApplication (supports both Java and Kotlin templates)
RUN find android/app/src/main/java -name "MainApplication.*" | xargs sed -i '/import com.facebook.react.ReactPackage/a import com.signageplayer.RestartPackage' || true
RUN find android/app/src/main/java -name "MainApplication.*" | xargs sed -i 's|// add(MyReactNativePackage())|add(RestartPackage())|g' || true
RUN find android/app/src/main/java -name "MainApplication.*" | xargs sed -i 's|// packages.add(new MyReactNativePackage());|packages.add(new RestartPackage());|g' || true

# ── Step 6: Configure Gradle for optimized release build ──────
RUN cd android && \
    # Ensure gradle.properties has the right settings
    echo "" >> gradle.properties && \
    echo "# Memory-optimized for CI (8GB host)" >> gradle.properties && \
    echo "org.gradle.jvmargs=-Xmx2048m -XX:+HeapDumpOnOutOfMemoryError" >> gradle.properties && \
    echo "org.gradle.workers.max=2" >> gradle.properties && \
    echo "org.gradle.parallel=false" >> gradle.properties && \
    echo "android.enableR8.fullMode=true" >> gradle.properties && \
    # Bump minSdk to 28 (Android 9) — all signage devices are 9+
    find . -name '*.gradle.kts' -o -name '*.gradle' | xargs sed -i 's/minSdk\s*=\s*[0-9]*/minSdk = 28/g'

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
