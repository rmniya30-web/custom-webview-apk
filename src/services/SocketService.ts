/**
 * SocketService — Socket.IO client for signage player
 *
 * Ported from digital-sign/app/player/page.tsx
 * Handles: connection, auth, heartbeat, reconnection, message dispatch
 */

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { SOCKET_URL } from '@env';
import { WebSocketMessage, DeviceConfig } from '../types';

const STORAGE_KEY = 'client_data';
const BACKUP_FILE = `${RNFS.DocumentDirectoryPath}/device_config.json`;

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class SocketService {
    private socket: Socket | null = null;
    private messageHandler: MessageHandler | null = null;
    private connectionHandler: ConnectionHandler | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Register handlers before connecting.
     */
    onMessage(handler: MessageHandler) {
        this.messageHandler = handler;
    }

    onConnectionChange(handler: ConnectionHandler) {
        this.connectionHandler = handler;
    }

    /**
     * Load saved token and connect to socket server.
     * If token exists, authenticates as returning device.
     * If no token, registers as new device (pairing flow).
     */
    async connect(): Promise<void> {
        // Disconnect existing socket if any
        this.disconnect();

        const socketUrl = SOCKET_URL || 'http://localhost:3001';
        let savedData: Partial<DeviceConfig> = {};

        try {
            const savedJson = await AsyncStorage.getItem(STORAGE_KEY);
            if (savedJson) {
                savedData = JSON.parse(savedJson);
                console.log('[Persistence] Loaded credentials from AsyncStorage:', savedData);
            } else {
                // Try backup file
                const exists = await RNFS.exists(BACKUP_FILE);
                if (exists) {
                    const fileContent = await RNFS.readFile(BACKUP_FILE, 'utf8');
                    savedData = JSON.parse(fileContent);
                    console.log('[Persistence] Loaded credentials from Backup File:', savedData);
                    // Restore to main storage
                    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
                } else {
                    console.log('[Persistence] No credentials found anywhere. Starting pairing.');
                }
            }
        } catch (error) {
            console.error('[Persistence] Failed to load credentials:', error);
        }

        const query: Record<string, string> = { type: 'client-player' };
        if (savedData.token) {
            query.token = savedData.token;
            if (savedData.id) query.deviceId = savedData.id;
            console.log('[Persistence] Found token, attempting auth');
        }

        const socket = io(socketUrl, {
            query,
            transports: ['websocket', 'polling'],
            reconnectionAttempts: Infinity,
            reconnectionDelay: 3000,
        });

        this.socket = socket;

        // ── Connection Events ────────────────────────────────────────

        socket.on('connect', () => {
            console.log('[Socket] Connected');
            this.connectionHandler?.(true);
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            // Request current state from server on (re)connect
            socket.emit('get_playback_state');
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            this.connectionHandler?.(false);

            // Auto-reconnect for network issues
            if (
                reason === 'io server disconnect' ||
                reason === 'transport close' ||
                reason === 'ping timeout'
            ) {
                if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = setTimeout(() => {
                    if (this.socket && !this.socket.connected) {
                        this.socket.connect();
                    }
                }, 3000);
            }
        });

        // ── Message Handler ─────────────────────────────────────────

        socket.on('message', (message: WebSocketMessage) => {
            this.messageHandler?.(message);
        });
    }

    /**
     * Start heartbeat emission every 60 seconds, aligned to the minute.
     * Sends RAM usage and requests state sync.
     */
    startHeartbeat(): void {
        this.stopHeartbeat();

        const sendBeat = () => {
            if (!this.socket?.connected) return;

            // Get memory info (approximate for RN)
            let ram = 0;
            let ramTotal = 0;
            try {
                // Use performance.memory if available (Hermes)
                const perf = (global as any).performance;
                if (perf?.memory) {
                    ram = perf.memory.usedJSHeapSize || 0;
                    ramTotal = perf.memory.jsHeapSizeLimit || 0;
                }
            } catch { }

            this.socket.emit('heartbeat', { ram, ramTotal });
            this.socket.emit('get_playback_state');
        };

        // Send immediately
        sendBeat();

        // Align to next minute boundary, then every 60s
        const now = new Date();
        const msUntilNextMinute =
            (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

        this.heartbeatTimeout = setTimeout(() => {
            sendBeat();
            this.heartbeatInterval = setInterval(sendBeat, 60000);
        }, msUntilNextMinute);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Save device credentials to AsyncStorage after pairing/auth.
     */
    async saveCredentials(config: Partial<DeviceConfig>): Promise<void> {
        console.log('[Persistence] Saving credentials:', config);
        const json = JSON.stringify(config);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, json);
            console.log('[Persistence] AsyncStorage save successful');
        } catch (error: any) {
            console.error('[Persistence] AsyncStorage save failed:', error);
        }

        try {
            await RNFS.writeFile(BACKUP_FILE, json, 'utf8');
            console.log('[Persistence] Backup file save successful');
        } catch (error: any) {
            console.error('[Persistence] Backup file save failed:', error);
        }
    }

    /**
     * Check if device has saved credentials.
     */
    async hasCredentials(): Promise<boolean> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (!data) return false;
            const parsed = JSON.parse(data);
            return !!parsed.token;
        } catch {
            return false;
        }
    }

    /**
     * Clear stored credentials (unpair).
     */
    async clearCredentials(): Promise<void> {
        console.log('[Persistence] Clearing credentials');
        await AsyncStorage.removeItem(STORAGE_KEY);
        try {
            if (await RNFS.exists(BACKUP_FILE)) {
                await RNFS.unlink(BACKUP_FILE);
            }
        } catch (e) {
            console.error('[Persistence] Failed to clear backup:', e);
        }
    }

    /**
     * Disconnect socket and clean up all timers.
     */
    disconnect(): void {
        this.stopHeartbeat();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Force reconnect (e.g., after app comes to foreground).
     */
    reconnect(): void {
        if (this.socket) {
            if (!this.socket.connected) {
                this.socket.connect();
            } else {
                this.socket.emit('get_playback_state');
            }
        }
    }

    get isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}

export const socketService = new SocketService();
