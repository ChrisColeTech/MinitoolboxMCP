import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { broadcast } from '../websocket.js';
import { logger } from '../utils/logger.js';

/**
 * Command routes — MCP → REST → WS → Frontend keyboard registry.
 */
export async function commandRoutes(fastify: FastifyInstance) {
    // Execute a keyboard command by ID
    fastify.post('/api/execute-command', async (req: FastifyRequest, reply: FastifyReply) => {
        const { command } = req.body as { command?: string };
        if (!command) {
            return reply.status(400).send({ error: 'Missing "command" in request body' });
        }
        broadcast('status:update', { executeCommand: command });
        logger.info(`Executed command: ${command}`);
        return { ok: true, command };
    });
}
