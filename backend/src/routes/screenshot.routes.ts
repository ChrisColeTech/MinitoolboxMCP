import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requestCapture, requestAppCapture } from '../websocket.js';
import type { ScreenshotController } from '../controllers/screenshot.controller.js';

/**
 * Screenshot routes — all JSON body payloads, no query strings or route params.
 */
export async function screenshotRoutes(
    fastify: FastifyInstance,
    controller: ScreenshotController,
) {
    // List all screenshots
    fastify.post('/api/screenshots/list', controller.listScreenshots);

    // Get current output directory
    fastify.post('/api/screenshots/get-output-dir', controller.getOutputDir);

    // Set output directory — body: { "path": "C:\\..." }
    fastify.post('/api/screenshots/set-output-dir', controller.setOutputDir);

    // Clear all screenshots
    fastify.post('/api/screenshots/clear', controller.clearCache);

    // Capture screenshot of a target window — body: { "sourceIndex": 0 }
    // MCP → REST → WS → Electron → WS → REST response
    fastify.post('/api/screenshots/capture', async (req: FastifyRequest, reply: FastifyReply) => {
        const { sourceIndex } = req.body as { sourceIndex: number };
        if (sourceIndex === undefined) {
            return reply.status(400).send({ error: 'Missing "sourceIndex" in request body' });
        }
        try {
            const result = await requestCapture(sourceIndex);
            return result;
        } catch (err: any) {
            return reply.status(504).send({ error: err.message });
        }
    });

    // Capture screenshot of the app's own UI — body: {}
    // Uses Electron's capturePage() — no desktopCapturer
    fastify.post('/api/app-screenshot', async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await requestAppCapture();
            return result;
        } catch (err: any) {
            return reply.status(504).send({ error: err.message });
        }
    });
}
