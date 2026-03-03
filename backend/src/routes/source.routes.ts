import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requestSelectSource, requestListSources } from '../websocket.js';
import { logger } from '../utils/logger.js';

/**
 * Source routes — select/list capture sources via WS relay to frontend.
 */
export async function sourceRoutes(fastify: FastifyInstance) {
    // Select a capture source by name — body: { "windowName": "Unity" }
    fastify.post('/api/sources/select', async (req: FastifyRequest, reply: FastifyReply) => {
        const { windowName } = req.body as { windowName?: string };
        if (!windowName) {
            return reply.status(400).send({ error: 'Missing "windowName" in request body' });
        }
        try {
            const result = await requestSelectSource(windowName);
            logger.info(`Selected source: ${result.selected}`);
            return result;
        } catch (err: any) {
            return reply.status(504).send({ error: err.message });
        }
    });

    // List all available capture sources
    fastify.post('/api/sources/list', async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await requestListSources();
            return result;
        } catch (err: any) {
            return reply.status(504).send({ error: err.message });
        }
    });
}
