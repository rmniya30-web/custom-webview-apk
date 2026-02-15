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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
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
// Watchdog: detect playback stuck for >20 seconds
const WATCHDOG_INTERVAL_MS = 5000;
const WATCHDOG_STUCK_THRESHOLD_MS = 20000;

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
    playlist,
    orientation,
    onRefresh,
}) => {
    // ── State ──────────────────────────────────────────────────────
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeSource, setActiveSource] = useState<string | null>(null);
    const [standbySource, setStandbySource] = useState<string | null>(null);
    const [activeKey, setActiveKey] = useState(0); // Force remount for single-video loop

    const currentIndexRef = useRef(0);
    const activeVideoRef = useRef<VideoRef>(null);
    const sessionStartRef = useRef(Date.now());
    const lastProgressRef = useRef(Date.now());
    const loopCountRef = useRef(0);

    // ── Initialize first video ─────────────────────────────────────
    useEffect(() => {
        if (playlist.length === 0) return;

        currentIndexRef.current = 0;
        setCurrentIndex(0);
        loopCountRef.current = 0;
        sessionStartRef.current = Date.now();

        loadVideo(playlist[0].url).then((path) => {
            setActiveSource(path);
        });

        // Prefetch next video
        if (playlist.length > 1) {
            loadVideo(playlist[1].url).then((path) => {
                setStandbySource(path);
            });
        }
    }, [playlist]);

    // ── Load video (cache-first) ───────────────────────────────────
    const loadVideo = async (url: string): Promise<string> => {
        const cached = await cacheService.prefetchVideo(url);
        // Return cached file path, or fall back to network URL
        return cached || url;
    };

    // ── Handle video end → advance playlist ────────────────────────
    const handleVideoEnd = useCallback(() => {
        if (playlist.length === 0) return;

        const current = currentIndexRef.current;
        const nextIdx = (current + 1) % playlist.length;
        const followingIdx = (nextIdx + 1) % playlist.length;

        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);

        // Reset progress tracker
        lastProgressRef.current = Date.now();

        // Track loops for periodic refresh
        loopCountRef.current += 1;

        // Check if session refresh is needed (at end of playlist loop)
        const isLastVideo = current === playlist.length - 1;
        const sessionDuration = Date.now() - sessionStartRef.current;

        if (isLastVideo) {
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

        // Swap: standby becomes active, prefetch next into standby
        if (standbySource) {
            setActiveSource(standbySource);
        }

        // For single-video loops, force remount since same source won't restart
        if (playlist.length === 1) {
            setActiveKey((prev) => prev + 1);
        }

        // Prefetch the following video into standby
        loadVideo(playlist[followingIdx].url).then((path) => {
            setStandbySource(path);
        });
    }, [playlist, standbySource, onRefresh]);

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

    // ── Orientation transform ──────────────────────────────────────
    const getContainerStyle = () => {
        switch (orientation) {
            case '90':
                return {
                    transform: [{ rotate: '90deg' }],
                    width: '100%' as any,
                    height: '100%' as any,
                };
            case '180':
                return {
                    transform: [{ rotate: '180deg' }],
                    width: '100%' as any,
                    height: '100%' as any,
                };
            case '270':
                return {
                    transform: [{ rotate: '270deg' }],
                    width: '100%' as any,
                    height: '100%' as any,
                };
            default:
                return {};
        }
    };

    if (!activeSource) {
        // Still loading first video — show black screen
        return <View style={styles.container} />;
    }

    const isFileUri = activeSource.startsWith('/');

    return (
        <View style={styles.container}>
            <View style={[styles.videoContainer, getContainerStyle()]}>
                {/* Active Player */}
                <Video
                    key={`active-${activeKey}`}
                    ref={activeVideoRef}
                    source={{
                        uri: isFileUri ? `file://${activeSource}` : activeSource,
                    }}
                    style={styles.video}
                    resizeMode="contain"
                    muted={true}
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
                    // ExoPlayer optimizations for low-end devices
                    bufferConfig={{
                        minBufferMs: 2000,
                        maxBufferMs: 10000,
                        bufferForPlaybackMs: 1000,
                        bufferForPlaybackAfterRebufferMs: 2000,
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
        justifyContent: 'center',
        alignItems: 'center',
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
