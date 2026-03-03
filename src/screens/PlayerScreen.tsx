/**
 * PlayerScreen — Dual-player gapless video playback
 *
 * Replaces MSE-based SeamlessPlayer with native react-native-video.
 * Architecture:
 *   - Two <Video> components: active (playing) and standby (preloading)
 *   - On video end → swap active/standby → instant transition
 *   - File-based caching via CacheService
 *   - Watchdog timer for stuck playback detection
 *   - 2-hour session refresh for memory leak prevention
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, Dimensions } from 'react-native';
import Video, { OnLoadData, OnProgressData, VideoRef } from 'react-native-video';
import { cacheService } from '../services/CacheService';
import { sendDiscordLog } from '../services/DiscordLogger';
import { VideoSource, Orientation } from '../types';

interface PlayerScreenProps {
    playlist: VideoSource[];
    orientation: Orientation;
    onRefresh: (reason: string) => void;
}

// Session refresh after 2 hours (matches web player)
const MAX_SESSION_MS = 2 * 60 * 60 * 1000;
// Watchdog: detect playback stuck for >30 seconds (increased for longer videos)
const WATCHDOG_INTERVAL_MS = 5000;
const WATCHDOG_STUCK_THRESHOLD_MS = 30000;

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
    playlist,
    orientation,
    onRefresh,
}) => {
    // ── State ──────────────────────────────────────────────────────
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeSource, setActiveSource] = useState<string | null>(null);

    const currentIndexRef = useRef(0);
    const standbySourceRef = useRef<string | null>(null); // Ref to avoid stale closures
    const activeVideoRef = useRef<VideoRef>(null);
    const sessionStartRef = useRef(Date.now());
    const lastProgressRef = useRef(Date.now());
    const lastEndEventRef = useRef(0);
    const loopCountRef = useRef(0);
    const playlistRef = useRef(playlist);
    playlistRef.current = playlist;

    // ── Initialize first video ─────────────────────────────────────
    useEffect(() => {
        if (playlist.length === 0) return;

        currentIndexRef.current = 0;
        setCurrentIndex(0);
        loopCountRef.current = 0;
        sessionStartRef.current = Date.now();
        standbySourceRef.current = null;

        loadVideo(playlist[0].url).then((path) => {
            setActiveSource(path);
        });
    }, [playlist]);

    // ── Declarative standby prefetching ────────────────────────────
    useEffect(() => {
        if (playlist.length <= 1) return;

        let isActive = true;
        const nextIdx = (currentIndex + 1) % playlist.length;

        // Clear old standby while caching the new one
        standbySourceRef.current = null;

        loadVideo(playlist[nextIdx].url).then((path) => {
            if (isActive) {
                standbySourceRef.current = path;
            }
        });

        return () => {
            isActive = false;
        };
    }, [currentIndex, playlist]);

    // ── Load video (cache-first) ───────────────────────────────────
    const loadVideo = async (url: string): Promise<string> => {
        const cached = await cacheService.prefetchVideo(url);
        // Return cached file path, or fall back to network URL
        return cached || url;
    };

    // ── Handle video end → advance playlist ────────────────────────
    // Uses refs only — no stale closure issues with long-running videos
    const handleVideoEnd = useCallback(() => {
        const pl = playlistRef.current;
        if (pl.length === 0) return;

        // Debounce: ignore if called within 500ms of last call
        const now = Date.now();
        if (now - lastEndEventRef.current < 500) return;
        lastEndEventRef.current = now;

        const current = currentIndexRef.current;
        const nextIdx = (current + 1) % pl.length;

        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);

        // Reset progress tracker
        lastProgressRef.current = Date.now();

        // Check if session refresh is needed (at end of playlist loop)
        const isLastVideo = current === pl.length - 1;
        const sessionDuration = Date.now() - sessionStartRef.current;

        if (isLastVideo) {
            // Track full loops for periodic refresh
            loopCountRef.current += 1;

            const shouldRefresh =
                sessionDuration >= MAX_SESSION_MS || loopCountRef.current >= 20;

            if (shouldRefresh) {
                const reason =
                    sessionDuration >= MAX_SESSION_MS ? '2hr Session' : 'Periodic';
                sendDiscordLog(
                    '🔄 Session Refresh',
                    `Scheduled memory cleanup.\n**Reason:** ${reason}`,
                    5763719,
                );
                onRefresh(`Memory Cleanup (${reason})`);
                return;
            }
        }

        // Read standby from ref (always latest value, never stale)
        const standby = standbySourceRef.current;
        if (standby) {
            setActiveSource(standby);
        } else {
            // Fallback to network URL if standby not ready
            setActiveSource(pl[nextIdx].url);
        }

        // Note: changing source.uri swaps media without recreating ExoPlayer.
        // No key remount needed — avoids MediaCodec thread thrashing.
    }, [onRefresh]);

    // ── Watchdog timer ─────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            const stuckDuration = Date.now() - lastProgressRef.current;
            if (stuckDuration > WATCHDOG_STUCK_THRESHOLD_MS) {
                sendDiscordLog(
                    '⚠️ Watchdog Recovery',
                    `Playback stuck for ${Math.round(stuckDuration / 1000)}s. Triggering reset.`,
                    16776960,
                );
                onRefresh('Playback Stuck (Watchdog)');
                lastProgressRef.current = Date.now(); // Prevent rapid-fire
            }
        }, WATCHDOG_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [onRefresh]);

    // ── App state handling (foreground/background) ─────────────────
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                lastProgressRef.current = Date.now(); // Reset watchdog
            }
        });
        return () => sub.remove();
    }, []);

    // ── Progress tracking (feeds watchdog) ─────────────────────────
    const handleProgress = useCallback((_data: OnProgressData) => {
        lastProgressRef.current = Date.now();
    }, []);

    // ── Error handling ─────────────────────────────────────────────
    const handleError = useCallback(
        (error: any) => {
            const msg = error?.error?.errorString || 'Unknown video error';
            sendDiscordLog('❌ Player Error', msg, 15548997);

            // Try to advance to next video
            setTimeout(() => {
                handleVideoEnd();
            }, 1000);
        },
        [handleVideoEnd],
    );

    // ── Orientation: CSS Transform rotation ────────────────────────
    // useTextureView={true} on <Video> renders through TextureView instead
    // of SurfaceView, which supports CSS transforms (rotation).
    // This works on all API levels including API 28.
    //
    // For 90°/270°: We make the container portrait-sized (screenH × screenW),
    // translate it to center on the landscape screen, then rotate.
    // No scaling = no pixel distortion. The video fills the portrait
    // container naturally via resizeMode="contain".
    const { width: screenW, height: screenH } = Dimensions.get('window');

    const rotationStyle = useMemo(() => {
        const deg = parseInt(String(orientation), 10) || 0;
        if (deg === 0) return {};

        const needsSwap = deg === 90 || deg === 270;
        if (needsSwap) {
            // Container becomes portrait: width=screenH, height=screenW
            // Translate to center it, then rotate
            return {
                position: 'absolute' as const,
                width: screenH,
                height: screenW,
                top: 0,
                left: 0,
                transform: [
                    { translateX: (screenW - screenH) / 2 },
                    { translateY: (screenH - screenW) / 2 },
                    { rotate: `${deg}deg` },
                ],
            };
        }

        // 180°: just flip upside-down, same dimensions
        return {
            transform: [{ rotate: `${deg}deg` }],
        };
    }, [orientation, screenW, screenH]);

    if (!activeSource) {
        // Still loading first video — show black screen
        return <View style={styles.container} />;
    }

    const isFileUri = activeSource.startsWith('/');

    return (
        <View style={styles.container}>
            <View style={[styles.videoContainer, rotationStyle]}>
                {/* Active Player */}
                <Video
                    key="active-player"
                    ref={activeVideoRef}
                    source={{
                        uri: isFileUri ? `file://${activeSource}` : activeSource,
                    }}
                    style={styles.video}
                    resizeMode="contain"
                    useTextureView={true}
                    muted={true}
                    rate={1.0} // Explicitly strictly 1x playback speed
                    repeat={playlist.length === 1} // Native loop for single video
                    paused={false}
                    playInBackground={false}
                    playWhenInactive={false}
                    disableFocus={true}
                    controls={false}
                    preventsDisplaySleepDuringVideoPlayback={true}
                    onProgress={handleProgress}
                    onEnd={() => {
                        if (playlist.length > 1) {
                            handleVideoEnd();
                        }
                        // Single video: handled by repeat={true}
                    }}
                    onError={handleError}
                    onLoad={(_data: OnLoadData) => {
                        lastProgressRef.current = Date.now();
                    }}
                    // ExoPlayer buffer config
                    bufferConfig={{
                        minBufferMs: 5000,
                        maxBufferMs: 50000,
                        bufferForPlaybackMs: 2500,
                        bufferForPlaybackAfterRebufferMs: 5000,
                    }}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    videoContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
    },
});

