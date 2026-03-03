import { create } from 'zustand';
import type { WindowSource, CaptureResult, Status } from '../types/electron';

// ── Types ──

export interface AppState {
    // Status bar
    status: Status;
    setStatus: (s: Status) => void;

    // Capture sources
    sources: WindowSource[];
    selectedSourceId: string;
    capture: CaptureResult | null;
    isLive: boolean;

    // Actions
    setSources: (sources: WindowSource[]) => void;
    setSelectedSourceId: (id: string) => void;
    setCapture: (capture: CaptureResult | null) => void;
    setIsLive: (live: boolean) => void;

    // High-level actions
    refreshSources: () => Promise<void>;
    selectSourceByName: (name: string) => boolean;
    captureOnce: (sourceId?: string) => Promise<void>;
    startLive: (sourceId?: string) => void;
    stopLive: () => void;
}

let liveInterval: ReturnType<typeof setInterval> | null = null;
let liveTimeout: ReturnType<typeof setTimeout> | null = null;

const LIVE_DURATION_MS = 5000;

export const useAppStore = create<AppState>((set, get) => ({
    // Status
    status: { message: 'Ready', type: 'idle' },
    setStatus: (status) => set({ status }),

    // Capture state
    sources: [],
    selectedSourceId: '',
    capture: null,
    isLive: false,

    // Setters
    setSources: (sources) => set({ sources }),
    setSelectedSourceId: (id) => set({ selectedSourceId: id }),
    setCapture: (capture) => set({ capture }),
    setIsLive: (isLive) => set({ isLive }),

    // ── High-level actions ──

    refreshSources: async () => {
        if (!window.electronAPI) {
            set({ status: { message: 'Not running in Electron', type: 'error' } });
            return;
        }
        set({ status: { message: 'Scanning...', type: 'idle' } });
        try {
            const sources = await window.electronAPI.getSources();
            set({
                sources,
                status: { message: `${sources.length} windows found`, type: 'success' },
            });
        } catch (err: any) {
            set({ status: { message: err.message, type: 'error' } });
        }
    },

    selectSourceByName: (name: string) => {
        const { sources, stopLive, captureOnce } = get();
        const needle = name.toLowerCase();

        // Priority: exact → starts-with → contains (prefer shorter/more specific)
        const match =
            sources.find((s) => s.name.toLowerCase() === needle) ||
            sources.filter((s) => s.name.toLowerCase().startsWith(needle)).sort((a, b) => a.name.length - b.name.length)[0] ||
            sources.filter((s) => s.name.toLowerCase().includes(needle)).sort((a, b) => a.name.length - b.name.length)[0];

        if (!match) return false;
        stopLive();
        set({ selectedSourceId: match.id });
        captureOnce(match.id);
        return true;
    },

    captureOnce: async (sourceId?: string) => {
        const id = sourceId || get().selectedSourceId;
        if (!id || !window.electronAPI) return;
        try {
            const result = await window.electronAPI.captureSource(id);
            set({
                capture: result,
                status: { message: `Saved → ${result.savedPath}`, type: 'success' },
            });
        } catch (err: any) {
            set({ status: { message: err.message, type: 'error' } });
        }
    },

    startLive: (sourceId?: string) => {
        const { captureOnce, stopLive, selectedSourceId } = get();
        const id = sourceId || selectedSourceId;
        if (!id) return;
        if (liveInterval) clearInterval(liveInterval);
        if (liveTimeout) clearTimeout(liveTimeout);
        captureOnce(id);
        liveInterval = setInterval(() => captureOnce(id), 500);
        set({ isLive: true });

        // Auto-stop after 5 seconds
        liveTimeout = setTimeout(() => stopLive(), LIVE_DURATION_MS);
    },

    stopLive: () => {
        if (liveInterval) {
            clearInterval(liveInterval);
            liveInterval = null;
        }
        if (liveTimeout) {
            clearTimeout(liveTimeout);
            liveTimeout = null;
        }
        set({ isLive: false });
    },
}));
