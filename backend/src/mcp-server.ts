import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { logger } from './utils/logger.js';
import { ScreenshotService } from './services/screenshot.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────

const OUTPUT_DIR = process.env.OUTPUT_DIR || join(__dirname, '..', '..', 'outputs');
const LOG_FILE = process.env.LOG_FILE || join(__dirname, '..', '..', 'logs', 'mcp.log');

// ─── Bootstrap ──────────────────────────────────────────────────

async function main() {
    logger.init(LOG_FILE);
    logger.info('Starting MinitoolboxMCP MCP server...');

    const screenshotService = new ScreenshotService(OUTPUT_DIR);

    const server = new McpServer({
        name: 'minitoolbox',
        version: '1.0.0',
    });

    // ─── Tool: list_screenshots ─────────────────────────────────

    server.tool(
        'list_screenshots',
        'List all saved screenshots in the output directory',
        {},
        async () => {
            const files = screenshotService.listScreenshots();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(files, null, 2),
                }],
            };
        },
    );

    // ─── Tool: get_output_dir ───────────────────────────────────

    server.tool(
        'get_output_dir',
        'Get the current screenshot output directory path',
        {},
        async () => {
            return {
                content: [{
                    type: 'text',
                    text: screenshotService.getOutputDir(),
                }],
            };
        },
    );

    // ─── Tool: clear_screenshots ────────────────────────────────

    server.tool(
        'clear_screenshots',
        'Delete all screenshots from the output directory',
        {},
        async () => {
            const count = screenshotService.clearCache();
            return {
                content: [{
                    type: 'text',
                    text: `Deleted ${count} screenshot(s).`,
                }],
            };
        },
    );

    // ─── Tool: capture_screenshot ───────────────────────────────
    // This will call the backend REST API which communicates
    // with Electron via WebSocket to trigger the actual capture.

    server.tool(
        'capture_screenshot',
        'Capture a screenshot of a running application window',
        {
            window_name: z.string().describe('Name or partial name of the window to capture (e.g. "unity" or "Chrome")'),
        },
        async ({ window_name }) => {
            try {
                const res = await fetch(`http://127.0.0.1:3100/api/screenshots/capture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ windowName: window_name }),
                });
                const data = await res.json() as any;
                if (data.error) {
                    return {
                        content: [{ type: 'text' as const, text: `Error: ${data.error}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{
                        type: 'text' as const,
                        text: `Screenshot captured: ${data.savedPath}\nSize: ${data.width}×${data.height}`,
                    }],
                };
            } catch (err: any) {
                return {
                    content: [{ type: 'text' as const, text: `Capture failed: ${err.message}` }],
                    isError: true,
                };
            }
        },
    );

    // ─── Start ──────────────────────────────────────────────────

    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('MCP server connected via stdio');
}

main().catch((err) => {
    logger.error('MCP server fatal error', err);
    process.exit(1);
});
