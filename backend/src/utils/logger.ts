import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
};

const RESET = '\x1b[0m';

class Logger {
    private fileStream: ReturnType<typeof createWriteStream> | null = null;
    private minLevel: LogLevel = 'debug';

    init(logFilePath: string, minLevel: LogLevel = 'debug') {
        this.minLevel = minLevel;
        const dir = dirname(logFilePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        this.fileStream = createWriteStream(logFilePath, { flags: 'a' });
        this.info(`Logger initialized → ${logFilePath}`);
    }

    private log(level: LogLevel, message: string, data?: unknown) {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

        const ts = new Date().toISOString();
        const tag = level.toUpperCase().padEnd(5);

        // Console output (colored)
        const color = LEVEL_COLOR[level];
        const consoleMsg = `${color}[${ts}] ${tag}${RESET} ${message}`;
        if (level === 'error') {
            console.error(consoleMsg, data ?? '');
        } else {
            console.log(consoleMsg, data ?? '');
        }

        // File output (plain)
        if (this.fileStream) {
            const fileMsg = `[${ts}] ${tag} ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
            this.fileStream.write(fileMsg);
        }
    }

    debug(msg: string, data?: unknown) { this.log('debug', msg, data); }
    info(msg: string, data?: unknown) { this.log('info', msg, data); }
    warn(msg: string, data?: unknown) { this.log('warn', msg, data); }
    error(msg: string, data?: unknown) { this.log('error', msg, data); }

    close() {
        this.fileStream?.end();
        this.fileStream = null;
    }
}

export const logger = new Logger();
