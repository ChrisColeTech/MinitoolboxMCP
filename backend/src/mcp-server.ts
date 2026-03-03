// Redirect stray stdout writes to stderr (protects JSON-RPC protocol)
const _origWrite = process.stdout.write.bind(process.stdout);
const _stderr = process.stderr.write.bind(process.stderr);
process.stdout.write = (chunk: any, ...args: any[]) => {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();
    if (str.startsWith('{') || str === '\n') return (_origWrite as any)(chunk, ...args);
    return _stderr(chunk, ...args) as any;
};
console.log = (...a: any[]) => { _stderr(a.join(' ') + '\n'); };
console.warn = (...a: any[]) => { _stderr(a.join(' ') + '\n'); };
console.error = (...a: any[]) => { _stderr(a.join(' ') + '\n'); };

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────

const LOG_FILE = process.env.LOG_FILE || join(__dirname, '..', '..', 'logs', 'mcp.log');
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3100';
const OUTPUTS_DIR = join(__dirname, '..', '..', 'outputs');

// ─── Helpers ────────────────────────────────────────────────────

async function post(path: string, body: Record<string, unknown> = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return await res.json() as any;
}

/** Capture the Electron app's own UI via capturePage() and return as MCP image content item */
async function captureAppScreenshot(): Promise<{ type: 'image'; data: string; mimeType: string } | null> {
    try {
        const data = await post('/api/app-screenshot');
        if (data.error || !data.savedPath) return null;

        // Read the saved file as base64
        if (data.savedPath && fs.existsSync(data.savedPath)) {
            const base64 = fs.readFileSync(data.savedPath).toString('base64');
            return { type: 'image' as const, data: base64, mimeType: 'image/png' };
        }

        // Fallback: extract base64 from dataUrl
        if (data.dataUrl) {
            const base64 = data.dataUrl.replace(/^data:image\/png;base64,/, '');
            return { type: 'image' as const, data: base64, mimeType: 'image/png' };
        }

        return null;
    } catch {
        return null;
    }
}

/** Wrap a tool handler to auto-append an app screenshot after execution */
function withScreenshot<T>(handler: (args: T) => Promise<{ content: any[] }>): (args: T) => Promise<{ content: any[] }> {
    return async (args: T) => {
        const result = await handler(args);
        // Small delay to let the UI settle before capturing
        await new Promise(r => setTimeout(r, 300));
        const img = await captureAppScreenshot();
        if (img) result.content.push(img);
        return result;
    };
}

// ─── Bootstrap ──────────────────────────────────────────────────

async function main() {
    logger.init(LOG_FILE);
    logger.info('Starting MinitoolboxMCP MCP server...');

    const server = new McpServer({
        name: 'minitoolbox',
        version: '1.0.0',
    });

    // ─── Tool: capture_screenshot ───────────────────────────────
    // Captures a target window by source index (from list_sources)

    server.tool(
        'capture_screenshot',
        'Capture a screenshot of a running application window. Returns the screenshot image directly.',
        {
            source_index: z.number().describe('Source index from list_sources (e.g. 4)'),
        },
        async ({ source_index }) => {
            try {
                const data = await post('/api/screenshots/capture', { sourceIndex: source_index });
                if (data.error) {
                    return { content: [{ type: 'text' as const, text: `Error: ${data.error}` }], isError: true };
                }

                const content: any[] = [{
                    type: 'text' as const,
                    text: `Screenshot captured: ${data.name}\nSaved: ${data.savedPath}\nSize: ${data.width}×${data.height}`,
                }];

                // Attach the captured image directly
                if (data.savedPath && fs.existsSync(data.savedPath)) {
                    const base64 = fs.readFileSync(data.savedPath).toString('base64');
                    content.push({ type: 'image' as const, data: base64, mimeType: 'image/png' });
                }

                return { content };
            } catch (err: any) {
                return { content: [{ type: 'text' as const, text: `Capture failed: ${err.message}` }], isError: true };
            }
        },
    );

    // ─── Tool: navigate_page ────────────────────────────────────

    server.tool(
        'navigate_page',
        'Navigate to a specific page in the UI. Valid pages: capture, gallery.',
        { page: z.enum(['capture', 'gallery']).describe('Page to navigate to') },
        withScreenshot(async ({ page }) => {
            try {
                await post('/api/navigate', { page });
                return { content: [{ type: 'text' as const, text: `✓ Navigated to ${page}.` }] };
            } catch (err: any) {
                return { content: [{ type: 'text' as const, text: `Navigation failed: ${err.message}` }], isError: true };
            }
        }),
    );

    // ─── Tool: execute_command ───────────────────────────────────

    server.tool(
        'execute_command',
        `Execute a keyboard shortcut / command by ID. Available commands:
  App:     app.toggle-devtools (F12), app.settings (Ctrl+,), app.reload (Ctrl+R),
           app.show-window, app.hide-window, app.quit (Ctrl+Q)
  View:    view.capture (Ctrl+1), view.gallery (Ctrl+2)
  Capture: capture.refresh (F5), capture.start-live, capture.stop-live, capture.once`,
        { command: z.string().describe('Command ID to execute, e.g. "app.toggle-devtools"') },
        withScreenshot(async ({ command }) => {
            try {
                await post('/api/execute-command', { command });
                return { content: [{ type: 'text' as const, text: `✓ Executed: ${command}` }] };
            } catch (err: any) {
                return { content: [{ type: 'text' as const, text: `Command failed: ${err.message}` }], isError: true };
            }
        }),
    );

    // ─── Tool: select_source ─────────────────────────────────────

    server.tool(
        'select_source',
        'Select a capture source window by name (fuzzy match). Also updates the frontend dropdown.',
        { window_name: z.string().describe('Name or partial name of the window to select (e.g. "Unity")') },
        withScreenshot(async ({ window_name }) => {
            try {
                const data = await post('/api/sources/select', { windowName: window_name });
                if (data.error) {
                    return { content: [{ type: 'text' as const, text: `Error: ${data.error}` }], isError: true };
                }
                return { content: [{ type: 'text' as const, text: `✓ Selected: ${data.selected}` }] };
            } catch (err: any) {
                return { content: [{ type: 'text' as const, text: `Select failed: ${err.message}` }], isError: true };
            }
        }),
    );

    // ─── Tool: list_sources ─────────────────────────────────────

    server.tool(
        'list_sources',
        'List all available windows for screenshot capture.',
        {},
        async () => {
            try {
                const data = await post('/api/sources/list');
                if (data.error) {
                    return { content: [{ type: 'text' as const, text: `Error: ${data.error}` }], isError: true };
                }
                const sources = data.sources ?? [];
                const lines = sources.map((s: any, i: number) => `${i}: ${s.name}`);
                return { content: [{ type: 'text' as const, text: `${sources.length} sources:\n${lines.join('\n')}` }] };
            } catch (err: any) {
                return { content: [{ type: 'text' as const, text: `List failed: ${err.message}` }], isError: true };
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
