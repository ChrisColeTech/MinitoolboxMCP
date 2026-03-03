// ─── Shared types for the backend ───────────────────────────────

export interface WindowSource {
    id: string;
    name: string;
    thumbnail: string;
}

export interface CaptureResult {
    dataUrl: string;
    width: number;
    height: number;
    name: string;
    savedPath: string;
}

export interface OutputFile {
    name: string;
    path: string;
    size: number;
}

export interface AppConfig {
    port: number;
    host: string;
    outputDir: string;
    logFile: string;
}

// ─── WebSocket message types ────────────────────────────────────

export type WsMessageType =
    | 'capture:request'
    | 'capture:result'
    | 'app:capture'
    | 'app:capture:result'
    | 'sources:list'
    | 'sources:select'
    | 'sources:result'
    | 'gallery:refresh'
    | 'gallery:result'
    | 'status:update'
    | 'error';

export interface WsMessage<T = unknown> {
    type: WsMessageType;
    payload: T;
    timestamp: number;
}
