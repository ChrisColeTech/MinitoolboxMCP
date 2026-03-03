import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { WsMessage } from './types/index.js';
import type { ScreenshotService } from './services/screenshot.service.js';
import { logger } from './utils/logger.js';

const clients = new Set<WebSocket>();

// ── Generic pending request-response map ──

interface PendingRequest {
    resolve: (result: any) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingRequest>();
let idCounter = 0;

function createPendingRequest(
    prefix: string,
    msgType: WsMessage['type'],
    payload: Record<string, unknown>,
    timeoutMs = 10000,
    timeoutMsg = 'Request timed out — is the Electron app running?',
): Promise<any> {
    const id = `${prefix}_${++idCounter}`;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(timeoutMsg));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        broadcast(msgType, { id, ...payload });
    });
}

// ── Public request functions ──

export function requestCapture(sourceIndex: number): Promise<any> {
    return createPendingRequest('cap', 'capture:request', { sourceIndex });
}

export function requestAppCapture(): Promise<any> {
    return createPendingRequest('app', 'app:capture', {});
}

export function requestSelectSource(windowName: string): Promise<any> {
    return createPendingRequest('sel', 'sources:select', { windowName });
}

export function requestListSources(): Promise<any> {
    return createPendingRequest('lst', 'sources:list', {});
}

// ── Broadcast ──

export function broadcast<T>(type: WsMessage['type'], payload: T) {
    const msg: WsMessage<T> = { type, payload, timestamp: Date.now() };
    const data = JSON.stringify(msg);
    for (const client of clients) {
        if (client.readyState === 1) {
            client.send(data);
        }
    }
}

// ── WebSocket endpoint ──

export async function registerWebSocket(
    fastify: FastifyInstance,
    screenshotService: ScreenshotService,
) {
    fastify.get('/ws', { websocket: true }, (socket, _req) => {
        const ws = socket as unknown as WebSocket;
        clients.add(ws);
        logger.info(`WebSocket client connected (${clients.size} total)`);

        broadcast('status:update', { connected: clients.size });

        ws.on('message', (raw) => {
            try {
                const msg: WsMessage = JSON.parse(raw.toString());
                handleMessage(ws, msg, screenshotService);
            } catch (err) {
                logger.error('Invalid WS message', err);
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
            logger.info(`WebSocket client disconnected (${clients.size} total)`);
        });
    });
}

async function handleMessage(
    ws: WebSocket,
    msg: WsMessage,
    screenshotService: ScreenshotService,
) {
    switch (msg.type) {
        case 'capture:result':
        case 'app:capture:result':
        case 'sources:result': {
            // Resolve pending REST request
            const payload = msg.payload as any;
            const p = pending.get(payload?.id);
            if (p) {
                clearTimeout(p.timer);
                pending.delete(payload.id);
                if (payload.error) {
                    p.reject(new Error(payload.error));
                } else {
                    p.resolve(payload);
                }
            }
            break;
        }

        case 'gallery:refresh': {
            const files = screenshotService.listScreenshots();
            const response: WsMessage = {
                type: 'gallery:result',
                payload: files,
                timestamp: Date.now(),
            };
            ws.send(JSON.stringify(response));
            break;
        }

        default:
            logger.warn(`Unknown WS message type: ${msg.type}`);
    }
}
