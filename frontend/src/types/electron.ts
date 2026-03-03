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
    dataUrl: string;
}

export type StatusType = 'idle' | 'success' | 'error';

export interface Status {
    message: string;
    type: StatusType;
}

export interface ElectronAPI {
    windowMinimize(): Promise<void>;
    windowMaximize(): Promise<void>;
    windowClose(): Promise<void>;
    windowIsMaximized(): Promise<boolean>;
    toggleDevTools(): Promise<void>;
    showWindow(): Promise<void>;
    hideWindow(): Promise<void>;
    quitApp(): Promise<void>;
    getSources(): Promise<WindowSource[]>;
    captureSource(sourceId: string): Promise<CaptureResult>;
    capturePage(outputPath?: string): Promise<{ ok: boolean; savedPath?: string; dataUrl?: string; width?: number; height?: number; error?: string }>;
    workerReady(): void;
    onCaptureRequest(callback: (sourceId: string, requestId: string) => void): void;
    sendCaptureResult(requestId: string, dataUrl: string, width: number, height: number): void;
    sendCaptureError(requestId: string, error: string): void;
    listOutputs(): Promise<OutputFile[]>;
    openExternal(filePath: string): Promise<void>;
    getOutputDir(): Promise<string>;
    setOutputDir(): Promise<string>;
    clearCache(): Promise<number>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
