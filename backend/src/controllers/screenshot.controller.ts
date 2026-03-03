import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ScreenshotService } from '../services/screenshot.service.js';

export class ScreenshotController {
    constructor(private screenshotService: ScreenshotService) { }

    listScreenshots = async (_req: FastifyRequest, reply: FastifyReply) => {
        const files = this.screenshotService.listScreenshots();
        return reply.send({ screenshots: files, count: files.length });
    };

    getOutputDir = async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.send({ outputDir: this.screenshotService.getOutputDir() });
    };

    setOutputDir = async (req: FastifyRequest<{ Body: { path: string } }>, reply: FastifyReply) => {
        const { path } = req.body;
        this.screenshotService.setOutputDir(path);
        return reply.send({ outputDir: path });
    };

    clearCache = async (_req: FastifyRequest, reply: FastifyReply) => {
        const count = this.screenshotService.clearCache();
        return reply.send({ deleted: count });
    };
}
