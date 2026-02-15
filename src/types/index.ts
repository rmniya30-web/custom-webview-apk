// Type definitions for the Signage Player app

export interface VideoSource {
    id?: string;
    url: string;
    name?: string;
    size?: number;
}

export interface Schedule {
    enabled: boolean;
    wakeTime: string;
    sleepTime: string;
}

export interface DeviceConfig {
    id: string;
    code: string;
    name: string;
    token: string;
    orientation?: '0' | '90' | '180' | '270';
    schedule?: Schedule;
}

export interface WebSocketMessage {
    type:
    | 'register'
    | 'content'
    | 'unpair'
    | 'paired'
    | 'heartbeat'
    | 'auth'
    | 'play'
    | 'stop'
    | 'hibernate'
    | 'play_list'
    | 'schedule_update'
    | 'sync_state'
    | 'reset';
    status?: string;
    payload?: {
        id?: string;
        token?: string;
        name?: string;
        code?: string;
        deviceId?: string;
        deviceName?: string;
        url?: string;
        orientation?: '0' | '90' | '180' | '270';
        playlist?: VideoSource[];
        schedule?: Schedule;
        startTime?: number;
        expiresIn?: number;
        reason?: string;
    };
}

export type AppState = 'loading' | 'pairing' | 'playing' | 'sleeping';

export type Orientation = '0' | '90' | '180' | '270';
