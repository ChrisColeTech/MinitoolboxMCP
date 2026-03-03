import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // ─── Window Controls ───
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // ─── Capture ───
    getSources: () => ipcRenderer.invoke('get-sources'),
    captureSource: (sourceId: string) => ipcRenderer.invoke('capture-source', sourceId),

    // ─── Capture Worker ───
    workerReady: () => ipcRenderer.send('capture-worker-ready'),
    onCaptureRequest: (callback: (sourceId: string, requestId: string) => void) => {
        ipcRenderer.on('capture-request', (_event, { sourceId, requestId }) => {
            callback(sourceId, requestId);
        });
    },
    sendCaptureResult: (requestId: string, dataUrl: string, width: number, height: number) => {
        ipcRenderer.send('capture-response', { requestId, success: true, dataUrl, width, height });
    },
    sendCaptureError: (requestId: string, error: string) => {
        ipcRenderer.send('capture-response', { requestId, success: false, error });
    },

    // ─── Gallery ───
    listOutputs: () => ipcRenderer.invoke('list-outputs'),
    openExternal: (filePath: string) => ipcRenderer.invoke('open-external', filePath),

    // ─── Settings ───
    getOutputDir: () => ipcRenderer.invoke('get-output-dir'),
    setOutputDir: () => ipcRenderer.invoke('set-output-dir'),
    clearCache: () => ipcRenderer.invoke('clear-cache'),
});
