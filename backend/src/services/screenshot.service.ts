import { readdirSync, statSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { OutputFile } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Screenshot service — manages the output directory, lists captures, clears cache.
 * Capture itself happens in Electron; this service manages the file-side operations
 * and will be called by both the MCP server and the REST API.
 */
export class ScreenshotService {
    private outputDir: string;

    constructor(outputDir: string) {
        this.outputDir = outputDir;
        if (!existsSync(this.outputDir)) {
            mkdirSync(this.outputDir, { recursive: true });
        }
        logger.info(`ScreenshotService initialized, outputDir: ${this.outputDir}`);
    }

    getOutputDir(): string {
        return this.outputDir;
    }

    setOutputDir(dir: string): void {
        this.outputDir = dir;
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        logger.info(`Output directory changed to: ${dir}`);
    }

    listScreenshots(): OutputFile[] {
        if (!existsSync(this.outputDir)) return [];

        return readdirSync(this.outputDir)
            .filter((f) => f.endsWith('.png'))
            .sort((a, b) => b.localeCompare(a))
            .map((f) => {
                const fullPath = join(this.outputDir, f);
                const stats = statSync(fullPath);
                return {
                    name: f,
                    path: fullPath,
                    size: stats.size,
                };
            });
    }

    clearCache(): number {
        if (!existsSync(this.outputDir)) return 0;

        const files = readdirSync(this.outputDir).filter((f) => f.endsWith('.png'));
        for (const f of files) {
            unlinkSync(join(this.outputDir, f));
        }
        logger.info(`Cleared ${files.length} screenshots`);
        return files.length;
    }
}
