import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { logger } from './utils/logger.js';
import { ScreenshotService } from './services/screenshot.service.js';
import { ScreenshotController } from './controllers/screenshot.controller.js';
import { screenshotRoutes } from './routes/screenshot.routes.js';
import { registerWebSocket } from './websocket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3100', 10);
const HOST = process.env.HOST || '127.0.0.1';
const OUTPUT_DIR = process.env.OUTPUT_DIR || join(__dirname, '..', '..', 'outputs');
const LOG_FILE = process.env.LOG_FILE || join(__dirname, '..', '..', 'logs', 'backend.log');

// ─── Bootstrap ──────────────────────────────────────────────────

async function main() {
    // Init logger
    logger.init(LOG_FILE);
    logger.info('Starting MinitoolboxMCP backend...');

    // Init services
    const screenshotService = new ScreenshotService(OUTPUT_DIR);

    // Init Fastify
    const fastify = Fastify({ logger: false });

    // Register WebSocket plugin
    await fastify.register(websocket);

    // Register WebSocket endpoint
    await registerWebSocket(fastify, screenshotService);

    // Register REST routes
    const controller = new ScreenshotController(screenshotService);
    await screenshotRoutes(fastify, controller);

    // Health check
    fastify.get('/api/health', async () => ({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));

    // Start
    try {
        await fastify.listen({ port: PORT, host: HOST });
        logger.info(`Server listening on http://${HOST}:${PORT}`);
        logger.info(`WebSocket available at ws://${HOST}:${PORT}/ws`);
    } catch (err) {
        logger.error('Failed to start server', err);
        process.exit(1);
    }
}

main();

export { main };
