/**
 * App.tsx — Root component / state machine
 *
 * States: loading → pairing → playing | sleeping
 *
 * Ported from digital-sign/app/player/page.tsx
 * with React Native adaptations.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StatusBar, AppState, AppStateStatus, NativeModules } from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import { ErrorBoundary } from './components/ErrorBoundary';
import { socketService } from './services/SocketService';
import { cacheService } from './services/CacheService';
import {
    sendDiscordLog,
    setDeviceInfo,
} from './services/DiscordLogger';
import { PairingScreen } from './screens/PairingScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SleepScreen } from './screens/SleepScreen';
import { AppState as SignageAppState, VideoSource, Orientation, WebSocketMessage } from './types';

const App: React.FC = () => {
    // ── State ────────────────────────────────────────────────────
    const [appState, setAppState] = useState<SignageAppState>('loading');
    const [pairingCode, setPairingCode] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [deviceCode, setDeviceCode] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [playlist, setPlaylist] = useState<VideoSource[]>([]);
    const [orientation, setOrientation] = useState<Orientation>('0');
    const [playerKey, setPlayerKey] = useState(0);

    const playlistRef = useRef<VideoSource[]>([]);
    const orientationRef = useRef<Orientation>('0');

    useEffect(() => {
        playlistRef.current = playlist;
    }, [playlist]);

    useEffect(() => {
        orientationRef.current = orientation;
    }, [orientation]);

    // ── Initialize ─────────────────────────────────────────────────
    useEffect(() => {
        // Hide status bar for kiosk mode
        StatusBar.setHidden(true, 'none');

        // Initialize cache
        cacheService.init();

        // Set up socket message handler
        socketService.onMessage(handleMessage);
        socketService.onConnectionChange((connected) => {
            if (connected) {
                // Re-sync on reconnect is handled by SocketService
            }
        });

        // Connect
        socketService.connect();

        // Schedule daily 3AM reset
        scheduleDailyReset();

        return () => {
            socketService.disconnect();
        };
    }, []);

    // ── App foreground/background handling ─────────────────────────
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                socketService.reconnect();
            }
        });
        return () => sub.remove();
    }, []);

    // ── 3AM Daily Hard Reset ───────────────────────────────────────
    const scheduleDailyReset = () => {
        const now = new Date();
        // Target: 3:00 AM local time (device timezone)
        const target = new Date();
        target.setHours(3, 0, 0, 0);
        if (now > target) {
            target.setDate(target.getDate() + 1);
        }

        const msUntilReset = target.getTime() - now.getTime();

        setTimeout(() => {
            sendDiscordLog(
                '🌙 Daily Maintenance',
                'Executing scheduled 3:00 AM Hard Reset.',
                5763719,
            );

            // Restart the app
            setTimeout(() => {
                if (NativeModules.RestartModule) {
                    NativeModules.RestartModule.restart();
                } else {
                    NativeModules.DevSettings?.reload?.();
                }
            }, 1000);
        }, msUntilReset);
    };

    // ── Socket Message Handler ─────────────────────────────────────
    const handleMessage = useCallback(
        async (message: WebSocketMessage) => {
            try {
                switch (message.type) {
                    // ── Registration (New device, no token) ──
                    case 'register':
                        if (message.payload?.code) {
                            setPairingCode(message.payload.code);
                            setAppState('pairing');
                        }
                        break;

                    // ── Paired (Dashboard claimed this device) ──
                    case 'paired':
                        if (message.payload) {
                            const { id, code, name, token } = message.payload as any;
                            setDeviceId(id || '');
                            setDeviceCode(code || '');
                            setDeviceName(name || '');
                            setDeviceInfo({ name: name || '', code: code || '', id: id || '' });
                            await socketService.saveCredentials({ id, code, name, token });
                            socketService.startHeartbeat();
                            setAppState('sleeping'); // Wait for playlist
                        }
                        break;

                    // ── Auth (Returning device, token recognized) ──
                    case 'auth':
                        if (message.payload) {
                            // Reset unpair retry counter on successful auth
                            socketService._unpairRetryCount = 0;
                            const p = message.payload as any;
                            setDeviceId(p.id || '');
                            setDeviceCode(p.code || '');
                            setDeviceName(p.name || '');
                            setOrientation(p.orientation || '0');
                            setDeviceInfo({
                                name: p.name || '',
                                code: p.code || '',
                                id: p.id || '',
                            });

                            socketService.startHeartbeat();

                            // Handle playlist from auth
                            if (p.playlist && Array.isArray(p.playlist) && p.playlist.length > 0) {
                                setPlaylist(p.playlist);
                                setPlayerKey((prev) => prev + 1);
                                setAppState('playing');
                            } else {
                                setAppState('sleeping');
                            }
                        }
                        break;

                    // ── Play single video ──
                    case 'play':
                        if (message.payload?.url) {
                            const singleVideo: VideoSource = { url: message.payload.url };
                            setPlaylist([singleVideo]);
                            setPlayerKey((prev) => prev + 1);
                            setAppState('playing');
                        }
                        break;

                    // ── Stop playback ──
                    case 'stop':
                        setPlaylist([]);
                        setAppState('sleeping');
                        break;

                    // ── Hibernate (server-driven sleep) ──
                    case 'hibernate':
                        setPlaylist([]);
                        setAppState('sleeping');
                        break;

                    // ── Playlist update ──
                    case 'play_list':
                        if (message.payload?.playlist) {
                            const newPlaylist = message.payload.playlist;

                            if (newPlaylist.length > 0) {
                                setPlaylist(newPlaylist);
                                setPlayerKey((prev) => prev + 1);
                                setAppState('playing');
                            } else {
                                setPlaylist([]);
                                setAppState('sleeping');
                            }
                        }
                        break;

                    // ── Sync state (heartbeat response with latest state) ──
                    case 'sync_state':
                        if (message.payload?.orientation !== undefined) {
                            const newOrientation = String(message.payload.orientation) as Orientation;
                            if (newOrientation !== orientationRef.current) {
                                console.log('[Orientation] Changed:', orientationRef.current, '→', newOrientation);
                                setOrientation(newOrientation);
                                // Clear cache (old videos are for wrong rotation) and restart player
                                cacheService.clearAll();
                                setPlayerKey((prev) => prev + 1);
                            }
                        }

                        if (message.payload?.playlist) {
                            const newPlaylist = message.payload.playlist;

                            // Smart sync: only reset player if playlist actually changed
                            const currentUrls = playlistRef.current.map((v) => v.url).join('|');
                            const newUrls = newPlaylist.map((v: any) => v.url).join('|');

                            if (currentUrls !== newUrls) {
                                if (newPlaylist.length > 0) {
                                    setPlaylist(newPlaylist);
                                    setPlayerKey((prev) => prev + 1);
                                    setAppState('playing');
                                } else {
                                    setPlaylist([]);
                                    setAppState('sleeping');
                                }
                            }
                        }
                        break;

                    // ── Unpair ──
                    case 'unpair':
                        // Retry before clearing — handles server restart races
                        if (!socketService._unpairRetryCount) {
                            socketService._unpairRetryCount = 1;
                            console.warn('[Socket] Received unpair. Retrying auth in 10s before clearing...');
                            socketService.disconnect();
                            await new Promise(r => setTimeout(r, 10000));
                            // Re-connect using saved credentials from storage
                            await socketService.connect();
                        } else {
                            // Second unpair — device was genuinely deleted
                            console.log('[Socket] Second unpair received. Clearing credentials.');
                            socketService._unpairRetryCount = 0;
                            await socketService.clearCredentials();
                            socketService.disconnect();
                            setAppState('loading');
                            socketService.connect();
                        }
                        break;

                    // ── Reset (manual from dashboard) ──
                    case 'reset':
                        sendDiscordLog(
                            '🔄 Manual Reset',
                            'Manual reset signal received from dashboard.',
                            16744192,
                        );
                        setTimeout(() => {
                            if (NativeModules.RestartModule) {
                                NativeModules.RestartModule.restart();
                            } else {
                                NativeModules.DevSettings?.reload?.();
                            }
                        }, 1000);
                        break;

                    // ── Schedule update (info only) ──
                    case 'schedule_update':
                        break;
                }
            } catch (err: any) {
                console.error('[handleMessage]', err?.message);
            }
        },
        [],
    );

    // ── Player refresh handler ─────────────────────────────────────
    const handleRefresh = useCallback(
        (reason: string) => {
            if (reason.includes('Watchdog')) {
                sendDiscordLog(
                    '⚠️ Watchdog Recovery',
                    `Player stuck triggered reset.\n**Reason:** ${reason}`,
                    16776960,
                );
            }
            if (reason.includes('2hr Session')) {
                sendDiscordLog(
                    '🔄 Session Refresh',
                    `Scheduled 2-hour memory cleanup.\n**Reason:** ${reason}`,
                    5763719,
                );
            }

            // Soft refresh: remount the player
            setPlayerKey((prev) => prev + 1);
        },
        [],
    );

    // ── Render ─────────────────────────────────────────────────────
    return (
        <ErrorBoundary
            onError={(err) => {
                console.error('[ErrorBoundary]', err.message);
            }}
        >
            <KeepAwake />
            <StatusBar hidden />

            {appState === 'loading' && <SleepScreen />}

            {appState === 'pairing' && <PairingScreen code={pairingCode} />}

            {appState === 'sleeping' && <SleepScreen />}

            {appState === 'playing' && playlist.length > 0 && (
                <PlayerScreen
                    key={playerKey}
                    playlist={playlist}
                    orientation={orientation}
                    onRefresh={handleRefresh}
                />
            )}
        </ErrorBoundary>
    );
};

export default App;
