import { app, BrowserWindow, ipcMain, desktopCapturer, Tray, Menu, nativeImage, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, fork } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let captureWorkerWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.ELECTRON_IS_DEV === '1';
const VITE_DEV_URL = 'http://localhost:5173';

// ─── Backend server (prod only) ─────────────────────────────────

function startBackendServer(): void {
    if (isDev) return; // In dev, backend runs separately via concurrently

    const serverPath = path.join(process.resourcesPath, 'backend', 'dist', 'server.js');
    if (!fs.existsSync(serverPath)) {
        console.error(`Backend server not found: ${serverPath}`);
        return;
    }

    console.log(`Starting backend server: ${serverPath}`);
    backendProcess = fork(serverPath, [], {
        cwd: path.join(process.resourcesPath, 'backend'),
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: 'pipe',
    });

    backendProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[backend] ${data.toString().trim()}`);
    });
    backendProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[backend] ${data.toString().trim()}`);
    });
    backendProcess.on('exit', (code) => {
        console.log(`Backend server exited with code ${code}`);
        backendProcess = null;
    });
}

function stopBackendServer(): void {
    if (backendProcess) {
        console.log('Stopping backend server...');
        backendProcess.kill('SIGTERM');
        backendProcess = null;
    }
}

// ─── Outputs directory ──────────────────────────────────────────

let customOutputDir: string | null = null;

function getOutputsDir(): string {
    if (customOutputDir && fs.existsSync(customOutputDir)) {
        return customOutputDir;
    }
    const base = isDev
        ? path.join(__dirname, '..', '..')
        : path.dirname(app.getPath('exe'));
    const dir = path.join(base, 'outputs');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

// ─── Capture Worker (hidden BrowserWindow) ──────────────────────

let captureWorkerReady = false;
const pendingCaptures = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
let requestCounter = 0;

function createCaptureWorker(): void {
    captureWorkerWindow = new BrowserWindow({
        show: false,
        width: 1,
        height: 1,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Load the same React app but at the /capture route
    if (isDev) {
        captureWorkerWindow.loadURL(`${VITE_DEV_URL}/#/capture`);
    } else {
        captureWorkerWindow.loadFile(
            path.join(process.resourcesPath, 'frontend', 'index.html'),
            { hash: '/capture' }
        );
    }
}

ipcMain.on('capture-worker-ready', () => {
    captureWorkerReady = true;
    console.log('Capture worker ready');
});

ipcMain.on('capture-response', (_event, response) => {
    const pending = pendingCaptures.get(response.requestId);
    if (!pending) return;
    pendingCaptures.delete(response.requestId);

    if (response.success) {
        pending.resolve(response);
    } else {
        pending.reject(new Error(response.error));
    }
});

async function captureWindowSource(sourceId: string, sourceName: string): Promise<any> {
    if (!captureWorkerWindow || !captureWorkerReady) {
        throw new Error('Capture worker not ready');
    }

    const requestId = `req-${++requestCounter}`;

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingCaptures.delete(requestId);
            reject(new Error('Capture timed out'));
        }, 10000);

        pendingCaptures.set(requestId, {
            resolve: (response: any) => {
                clearTimeout(timeout);

                // Auto-save to outputs/
                const base64 = response.dataUrl.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64, 'base64');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const safeName = sourceName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                const filePath = path.join(getOutputsDir(), `${safeName}-${timestamp}.png`);
                fs.writeFileSync(filePath, buffer);
                console.log(`Screenshot saved: ${filePath}`);

                resolve({
                    dataUrl: response.dataUrl,
                    width: response.width,
                    height: response.height,
                    name: sourceName,
                    savedPath: filePath,
                });
            },
            reject: (err: any) => {
                clearTimeout(timeout);
                reject(err);
            },
        });

        captureWorkerWindow!.webContents.send('capture-request', { sourceId, requestId });
    });
}

// ─── Main Window ────────────────────────────────────────────────

function createMainWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        title: 'MinitoolboxMCP',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL(VITE_DEV_URL);
    } else {
        mainWindow.loadFile(path.join(process.resourcesPath, 'frontend', 'index.html'));
    }

    mainWindow.on('close', (event) => {
        if (mainWindow && !isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── Tray ───────────────────────────────────────────────────────

async function buildTrayMenu(): Promise<Menu> {
    const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1, height: 1 },
    });

    const windowItems: Electron.MenuItemConstructorOptions[] = sources
        .filter((s) => s.name && s.name.trim().length > 0)
        .map((s) => ({
            label: s.name.length > 50 ? s.name.substring(0, 50) + '…' : s.name,
            click: async () => {
                try {
                    const result = await captureWindowSource(s.id, s.name);
                    console.log(`Tray capture: ${result.savedPath}`);
                } catch (err) {
                    console.error('Tray capture failed:', err);
                }
            },
        }));

    return Menu.buildFromTemplate([
        {
            label: 'Show Window',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
        { type: 'separator' },
        { label: '📸 Capture Window', enabled: false },
        ...windowItems,
        { type: 'separator' },
        {
            label: 'Refresh',
            click: async () => {
                const menu = await buildTrayMenu();
                tray?.setContextMenu(menu);
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);
}

async function createTray(): Promise<void> {
    const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
    let icon: Electron.NativeImage;
    if (fs.existsSync(iconPath)) {
        icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } else {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('MinitoolboxMCP');

    const menu = await buildTrayMenu();
    tray.setContextMenu(menu);

    tray.on('right-click', async () => {
        const freshMenu = await buildTrayMenu();
        tray?.setContextMenu(freshMenu);
        tray?.popUpContextMenu();
    });

    tray.on('double-click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}

// ─── IPC: Window controls ───────────────────────────────────────

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow?.maximize();
    }
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('toggle-devtools', () => mainWindow?.webContents.toggleDevTools());
ipcMain.handle('show-window', () => {
    mainWindow?.show();
    mainWindow?.focus();
});
ipcMain.handle('hide-window', () => mainWindow?.hide());
ipcMain.handle('quit-app', () => {
    app.quit();
});

// ─── IPC: App self-screenshot (capturePage) ─────────────────────

ipcMain.handle('capture-page', async (_event, outputPath?: string): Promise<{
    ok: boolean; savedPath?: string; dataUrl?: string; width?: number; height?: number; error?: string;
}> => {
    if (!mainWindow) return { ok: false, error: 'No main window' };
    try {
        const image = await mainWindow.webContents.capturePage();
        const pngBuffer = image.toPNG();
        const size = image.getSize();
        const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const finalPath = outputPath || path.join(getOutputsDir(), `app-${timestamp}.png`);
        const dir = path.dirname(finalPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(finalPath, pngBuffer);

        return { ok: true, savedPath: finalPath, dataUrl, width: size.width, height: size.height };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
});

// ─── IPC: Capture & Sources ────────────────────────────────────

ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 200, height: 200 },
    });
    return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
    }));
});

ipcMain.handle('capture-source', async (_event, sourceId: string) => {
    const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1, height: 1 },
    });
    const target = sources.find((s) => s.id === sourceId);
    if (!target) throw new Error(`Source not found: ${sourceId}`);

    return captureWindowSource(sourceId, target.name);
});

// Gallery: list all screenshots in the outputs directory
ipcMain.handle('list-outputs', async () => {
    const dir = getOutputsDir();
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .sort((a, b) => b.localeCompare(a)); // newest first

    return files.map((f) => ({
        name: f,
        path: path.join(dir, f),
        // Read file as base64 for thumbnail display
        dataUrl: `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`,
    }));
});

// Gallery: open file in system default app
ipcMain.handle('open-external', async (_event, filePath: string) => {
    await shell.openPath(filePath);
});

// Settings: get current output directory
ipcMain.handle('get-output-dir', () => {
    return getOutputsDir();
});

// Settings: set custom output directory
ipcMain.handle('set-output-dir', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Output Folder',
    });
    if (!result.canceled && result.filePaths[0]) {
        customOutputDir = result.filePaths[0];
        return customOutputDir;
    }
    return getOutputsDir();
});

// Settings: clear cache (delete all PNGs in outputs)
ipcMain.handle('clear-cache', async () => {
    const dir = getOutputsDir();
    if (!fs.existsSync(dir)) return 0;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    for (const f of files) {
        fs.unlinkSync(path.join(dir, f));
    }
    console.log(`Cleared ${files.length} screenshots from ${dir}`);
    return files.length;
});

// ─── App Lifecycle ──────────────────────────────────────────────

app.whenReady().then(async () => {
    startBackendServer();
    createCaptureWorker();
    await createTray();
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length <= 1) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Tray keeps the app alive
});

app.on('will-quit', () => {
    stopBackendServer();
    if (isDev) {
        require('child_process').exec('npx -y kill-port 5173');
    }
});
