import type { FastifyInstance } from 'fastify';
import type { ScreenshotController } from '../controllers/screenshot.controller.js';

export async function screenshotRoutes(
    fastify: FastifyInstance,
    controller: ScreenshotController,
) {
    fastify.get('/api/screenshots', controller.listScreenshots);
    fastify.get('/api/screenshots/output-dir', controller.getOutputDir);
    fastify.post('/api/screenshots/output-dir', controller.setOutputDir);
    fastify.post('/api/screenshots/clear', controller.clearCache);
}
