/**
 * Command definitions for keyboard shortcuts.
 *
 * Pure logic module — no React imports.
 * Actions call into electronAPI, dispatch window events, or use the store.
 *
 * Ported from BgEditor (3dModelEditor-v3).
 */

import { registry } from './keyboardRegistry';
import { useAppStore } from '../../store/useAppStore';

// ── Types ──

export type CommandCategory = 'App' | 'View' | 'Capture';

export interface Command {
    id: string;
    label: string;
    icon: string;
    shortcut?: string;
    category: CommandCategory;
    action: () => void;
    when?: () => boolean;
}

// ── Command Definitions ──

export function buildCommands(): Command[] {
    const store = () => useAppStore.getState();

    return [
        // ── App ──
        {
            id: 'app.toggle-devtools',
            label: 'Toggle Developer Tools',
            icon: 'Code',
            shortcut: 'F12',
            category: 'App',
            action: () => window.electronAPI?.toggleDevTools(),
        },
        {
            id: 'app.settings',
            label: 'Open Settings',
            icon: 'Settings',
            shortcut: 'Ctrl+,',
            category: 'App',
            action: () => window.dispatchEvent(new CustomEvent('shortcut:settings')),
        },
        {
            id: 'app.reload',
            label: 'Reload Window',
            icon: 'RefreshCw',
            shortcut: 'Ctrl+R',
            category: 'App',
            action: () => window.location.reload(),
        },
        {
            id: 'app.show-window',
            label: 'Show Window',
            icon: 'Eye',
            category: 'App',
            action: () => window.electronAPI?.showWindow(),
        },
        {
            id: 'app.hide-window',
            label: 'Hide Window',
            icon: 'EyeOff',
            category: 'App',
            action: () => window.electronAPI?.hideWindow(),
        },
        {
            id: 'app.quit',
            label: 'Quit Application',
            icon: 'Power',
            shortcut: 'Ctrl+Q',
            category: 'App',
            action: () => window.electronAPI?.quitApp(),
        },

        // ── View ──
        {
            id: 'view.capture',
            label: 'Go to Capture',
            icon: 'Camera',
            shortcut: 'Ctrl+1',
            category: 'View',
            action: () => window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: '/' })),
        },
        {
            id: 'view.gallery',
            label: 'Go to Gallery',
            icon: 'Image',
            shortcut: 'Ctrl+2',
            category: 'View',
            action: () => window.dispatchEvent(new CustomEvent('shortcut:navigate', { detail: '/gallery' })),
        },

        // ── Capture ──
        {
            id: 'capture.refresh',
            label: 'Refresh Sources',
            icon: 'RefreshCw',
            shortcut: 'F5',
            category: 'Capture',
            action: () => store().refreshSources(),
        },
        {
            id: 'capture.start-live',
            label: 'Start Live Preview',
            icon: 'Play',
            category: 'Capture',
            action: () => store().startLive(),
        },
        {
            id: 'capture.stop-live',
            label: 'Stop Live Preview',
            icon: 'Square',
            category: 'Capture',
            action: () => store().stopLive(),
        },
        {
            id: 'capture.once',
            label: 'Capture Once',
            icon: 'Camera',
            category: 'Capture',
            action: () => store().captureOnce(),
        },
        {
            id: 'capture.clear-cache',
            label: 'Clear Cache',
            icon: 'Trash2',
            category: 'Capture',
            action: async () => {
                const count = await window.electronAPI?.clearCache();
                console.log(`Cleared ${count} screenshots`);
            },
        },
    ];
}

// ── Registration ──

export function registerAllCommands(): Command[] {
    const commands = buildCommands();
    for (const cmd of commands) {
        if (cmd.shortcut) {
            registry.register(cmd.id, cmd.shortcut, cmd.action, cmd.when);
        } else {
            registry.registerAction(cmd.id, cmd.action);
        }
    }
    return commands;
}
