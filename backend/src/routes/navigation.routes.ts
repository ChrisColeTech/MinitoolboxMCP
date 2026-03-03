import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { broadcast } from '../websocket.js';
import { logger } from '../utils/logger.js';

/**
 * Navigation routes — MCP → REST → WS → Frontend router.
 */
export async function navigationRoutes(fastify: FastifyInstance) {
    // Navigate to a specific page
    fastify.post('/api/navigate', async (req: FastifyRequest, reply: FastifyReply) => {
        const { page } = req.body as { page?: string };
        if (!page) {
            return reply.status(400).send({ error: 'Missing "page" in request body' });
        }
        const validPages = ['capture', 'gallery'];
        if (!validPages.includes(page)) {
            return reply.status(400).send({ error: `Invalid page "${page}". Valid: ${validPages.join(', ')}` });
        }
        broadcast('status:update', { navigate: page });
        logger.info(`Navigated to page: ${page}`);
        return { ok: true, page };
    });
}
