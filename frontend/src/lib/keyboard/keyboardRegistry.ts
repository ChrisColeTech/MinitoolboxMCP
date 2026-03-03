/**
 * Centralized keyboard shortcut registry.
 *
 * Parses human-readable shortcut strings ("Ctrl+Shift+Z", "F12", "Space")
 * into descriptors, matches them against KeyboardEvents, and dispatches
 * the first matching action.
 *
 * Pure logic module — no React imports, no store access.
 *
 * Ported from BgEditor (3dModelEditor-v3).
 */

// ── Types ──

export interface ShortcutDescriptor {
    key: string;        // lowercase key value (e.g. "z", "f12", "space", "escape")
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
}

export interface Binding {
    id: string;
    shortcut: string;               // original human string, e.g. "Ctrl+Z"
    descriptor: ShortcutDescriptor;
    action: () => void;
    /** Optional predicate — binding only fires when this returns true. */
    when?: () => boolean;
}

/** Action-only registration (no keyboard shortcut) for executeById support. */
export interface ActionEntry {
    id: string;
    action: () => void;
}

// ── Parsing ──

const KEY_ALIASES: Record<string, string> = {
    'esc': 'escape',
    'del': 'delete',
    'ins': 'insert',
    'return': 'enter',
    ' ': 'space',
};

/** Parse "Ctrl+Shift+Z" -> ShortcutDescriptor */
export function parseShortcut(shortcut: string): ShortcutDescriptor {
    const parts = shortcut.split('+').map((p) => p.trim().toLowerCase());
    let ctrl = false;
    let shift = false;
    let alt = false;
    let meta = false;
    let key = '';

    for (const part of parts) {
        if (part === 'ctrl' || part === 'control') ctrl = true;
        else if (part === 'shift') shift = true;
        else if (part === 'alt') alt = true;
        else if (part === 'meta' || part === 'cmd' || part === 'command') meta = true;
        else key = KEY_ALIASES[part] ?? part;
    }

    return { key, ctrl, shift, alt, meta };
}

/** Normalize a KeyboardEvent key to our canonical form */
function normalizeKey(e: KeyboardEvent): string {
    const k = e.key.toLowerCase();
    return KEY_ALIASES[k] ?? k;
}

// ── Registry ──

export class KeyboardRegistry {
    private bindings: Binding[] = [];
    private actions: ActionEntry[] = [];
    private enabled = true;

    /** Tags whose focus should suppress non-modifier shortcuts */
    private static IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

    register(id: string, shortcut: string, action: () => void, when?: () => boolean): void {
        this.unregister(id);
        const descriptor = parseShortcut(shortcut);
        this.bindings.push({ id, shortcut, descriptor, action, when });
    }

    /** Register a command action by ID only (no keyboard shortcut). */
    registerAction(id: string, action: () => void): void {
        this.actions = this.actions.filter((a) => a.id !== id);
        this.actions.push({ id, action });
    }

    unregister(id: string): void {
        this.bindings = this.bindings.filter((b) => b.id !== id);
        this.actions = this.actions.filter((a) => a.id !== id);
    }

    /** Enable/disable the entire registry (useful for modal overlays) */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /** Get all bindings, for display in the UI */
    getBindings(): ReadonlyArray<Binding> {
        return this.bindings;
    }

    /** Execute a command by its ID (used by MCP execute_command). */
    executeById(id: string): boolean {
        const binding = this.bindings.find((b) => b.id === id);
        if (binding) {
            binding.action();
            return true;
        }
        const entry = this.actions.find((a) => a.id === id);
        if (entry) {
            entry.action();
            return true;
        }
        return false;
    }

    /** The single keydown handler — attach this to `window`. */
    handleKeyDown = (e: KeyboardEvent): void => {
        if (!this.enabled) return;

        const key = normalizeKey(e);
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // For non-modifier shortcuts (plain keys like G, R, S),
        // ignore if focus is inside an input element.
        const isPlainKey = !ctrl && !alt;
        if (isPlainKey && KeyboardRegistry.IGNORED_TAGS.has((e.target as HTMLElement)?.tagName)) {
            return;
        }

        for (const binding of this.bindings) {
            const d = binding.descriptor;
            if (
                d.key === key &&
                d.ctrl === ctrl &&
                d.shift === shift &&
                d.alt === alt &&
                (!binding.when || binding.when())
            ) {
                e.preventDefault();
                e.stopPropagation();
                binding.action();
                return;
            }
        }
    };
}

/** Singleton instance */
export const registry = new KeyboardRegistry();
