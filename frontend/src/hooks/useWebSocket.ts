import { useState, useEffect, useRef, useCallback } from 'react';
import { registry } from '../lib/keyboard/keyboardRegistry';
import { useAppStore } from '../store/useAppStore';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

const WS_URL = 'ws://localhost:3100/ws';
const RECONNECT_DELAY = 3000;

// ── WS Response Helpers ──

function sendWsResponse(ws: WebSocket, type: string, id: string, payload: any, error?: string) {
    ws.send(JSON.stringify({
        type,
        payload: error ? { id, error } : { id, ...payload },
        timestamp: Date.now(),
    }));
}

// ── Capture Request Handler (by source index) ──

async function handleCaptureRequest(ws: WebSocket, id: string, sourceIndex: number) {
    try {
        if (!window.electronAPI) {
            sendWsResponse(ws, 'capture:result', id, null, 'Electron API not available');
            return;
        }
        const sources = useAppStore.getState().sources;
        if (sourceIndex < 0 || sourceIndex >= sources.length) {
            sendWsResponse(ws, 'capture:result', id, null,
                `Invalid source index ${sourceIndex}. Call list_sources first. Have ${sources.length} cached sources.`);
            return;
        }

        const source = sources[sourceIndex];
        const result = await window.electronAPI.captureSource(source.id);
        sendWsResponse(ws, 'capture:result', id, {
            dataUrl: result.dataUrl,
            width: result.width,
            height: result.height,
            name: source.name,
            savedPath: result.savedPath,
        });
    } catch (err: any) {
        sendWsResponse(ws, 'capture:result', id, null, err.message || 'Capture failed');
    }
}

// ── App Self-Screenshot Handler (capturePage) ──

async function handleAppCapture(ws: WebSocket, id: string) {
    try {
        if (!window.electronAPI?.capturePage) {
            sendWsResponse(ws, 'app:capture:result', id, null, 'capturePage not available');
            return;
        }
        const result = await window.electronAPI.capturePage();
        sendWsResponse(ws, 'app:capture:result', id, {
            savedPath: result.savedPath,
            dataUrl: result.dataUrl,
            width: result.width,
            height: result.height,
        });
    } catch (err: any) {
        sendWsResponse(ws, 'app:capture:result', id, null, err.message || 'App capture failed');
    }
}

// ── Select Source Handler ──

async function handleSelectSource(ws: WebSocket, id: string, windowName: string) {
    try {
        await useAppStore.getState().refreshSources();
        const found = useAppStore.getState().selectSourceByName(windowName);
        if (found) {
            const state = useAppStore.getState();
            const selected = state.sources.find((s) => s.id === state.selectedSourceId);
            sendWsResponse(ws, 'sources:result', id, {
                selected: selected?.name ?? windowName,
                sourceId: state.selectedSourceId,
            });
        } else {
            const names = useAppStore.getState().sources.map((s) => s.name);
            sendWsResponse(ws, 'sources:result', id, null,
                `No window matching "${windowName}". Available: ${names.join(', ')}`);
        }
    } catch (err: any) {
        sendWsResponse(ws, 'sources:result', id, null, err.message);
    }
}

// ── List Sources Handler ──

async function handleListSources(ws: WebSocket, id: string) {
    try {
        await useAppStore.getState().refreshSources();
        const sources = useAppStore.getState().sources.map((s) => ({
            id: s.id,
            name: s.name,
        }));
        sendWsResponse(ws, 'sources:result', id, { sources, count: sources.length });
    } catch (err: any) {
        sendWsResponse(ws, 'sources:result', id, null, err.message);
    }
}

export function useWebSocket() {
    const [status, setStatus] = useState<WsStatus>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setStatus('connecting');
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            setStatus('connected');
        };

        ws.onclose = () => {
            setStatus('disconnected');
            wsRef.current = null;
            reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        };

        ws.onerror = () => {
            ws.close();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                const payload = msg.payload ?? {};

                // Handle navigate command from MCP
                if (msg.type === 'status:update' && payload.navigate) {
                    const pageMap: Record<string, string> = { capture: '/', gallery: '/gallery' };
                    const path = pageMap[payload.navigate];
                    if (path) window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: path }));
                }

                // Handle execute command from MCP
                if (msg.type === 'status:update' && payload.executeCommand) {
                    registry.executeById(payload.executeCommand);
                }

                // Handle capture request (by source index)
                if (msg.type === 'capture:request' && payload.id !== undefined && payload.sourceIndex !== undefined) {
                    handleCaptureRequest(ws, payload.id, payload.sourceIndex);
                }

                // Handle app self-screenshot request
                if (msg.type === 'app:capture' && payload.id) {
                    handleAppCapture(ws, payload.id);
                }

                // Handle select source by name from MCP
                if (msg.type === 'sources:select' && payload.id && payload.windowName) {
                    handleSelectSource(ws, payload.id, payload.windowName);
                }

                // Handle list sources request from MCP
                if (msg.type === 'sources:list' && payload.id) {
                    handleListSources(ws, payload.id);
                }

                console.debug('[WS]', msg.type, payload);
            } catch { /* ignore */ }
        };

        wsRef.current = ws;
    }, []);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    const send = useCallback((type: string, payload: unknown = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
        }
    }, []);

    return { status, send };
}
