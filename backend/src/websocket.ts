import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { WsMessage } from './types/index.js';
import type { ScreenshotService } from './services/screenshot.service.js';
import { logger } from './utils/logger.js';

const clients = new Set<WebSocket>();

/**
 * Broadcast a message to all connected WebSocket clients.
 */
export function broadcast<T>(type: WsMessage['type'], payload: T) {
    const msg: WsMessage<T> = {
        type,
        payload,
        timestamp: Date.now(),
    };
    const data = JSON.stringify(msg);
    for (const client of clients) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(data);
        }
    }
}

/**
 * Register the /ws WebSocket endpoint.
 */
export async function registerWebSocket(
    fastify: FastifyInstance,
    screenshotService: ScreenshotService,
) {
    fastify.get('/ws', { websocket: true }, (socket, _req) => {
        const ws = socket as unknown as WebSocket;
        clients.add(ws);
        logger.info(`WebSocket client connected (${clients.size} total)`);

        // Send initial status
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
        case 'sources:list':
            // Frontend asks for sources — we relay to Electron or respond with error
            logger.debug('WS: sources:list requested');
            break;

        case 'capture:request':
            logger.debug('WS: capture:request', msg.payload);
            break;

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
