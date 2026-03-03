import { useState, useRef, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import type { WindowSource, CaptureResult, Status } from '../../types/electron';
import Preview from '../../components/Preview';

type LayoutContext = {
    status: Status;
    setStatus: (s: Status) => void;
};

export default function IndexPage() {
    const { setStatus } = useOutletContext<LayoutContext>();
    const [sources, setSources] = useState<WindowSource[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [capture, setCapture] = useState<CaptureResult | null>(null);
    const [isLive, setIsLive] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const hasElectron = typeof window !== 'undefined' && !!window.electronAPI;

    const refreshSources = useCallback(async () => {
        if (!hasElectron) {
            setStatus({ message: 'Not running in Electron', type: 'error' });
            return;
        }
        setStatus({ message: 'Scanning...', type: 'idle' });
        try {
            const srcs = await window.electronAPI.getSources();
            setSources(srcs);
            setStatus({ message: `${srcs.length} windows found`, type: 'success' });
        } catch (err: any) {
            setStatus({ message: err.message, type: 'error' });
        }
    }, [hasElectron, setStatus]);

    // Initial fetch + 30-second polling
    useEffect(() => {
        refreshSources();
        pollRef.current = setInterval(refreshSources, 30_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [refreshSources]);

    const captureOnce = useCallback(async (sourceId: string) => {
        if (!sourceId || !hasElectron) return;
        try {
            const result = await window.electronAPI.captureSource(sourceId);
            setCapture(result);
            setStatus({ message: `Saved → ${result.savedPath}`, type: 'success' });
        } catch (err: any) {
            setStatus({ message: err.message, type: 'error' });
        }
    }, [hasElectron, setStatus]);

    const startLive = useCallback((sourceId: string) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (!sourceId) return;
        captureOnce(sourceId);
        intervalRef.current = setInterval(() => captureOnce(sourceId), 500);
        setIsLive(true);
    }, [captureOnce]);

    const stopLive = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsLive(false);
    }, []);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const handleSourceChange = (id: string) => {
        setSelectedId(id);
        stopLive();
        if (id) captureOnce(id);
        else setCapture(null);
    };

    const handleToggleLive = () => {
        isLive ? stopLive() : startLive(selectedId);
    };

    return (
        <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-surface-1 border-b border-border shrink-0">
                <select
                    value={selectedId}
                    onChange={(e) => handleSourceChange(e.target.value)}
                    disabled={sources.length === 0}
                    className="flex-1 max-w-sm px-3 py-1.5 rounded-md border border-border bg-surface-0 text-text text-xs
                     outline-none transition-colors focus:border-border-focus disabled:opacity-40"
                >
                    <option value="">
                        {sources.length > 0 ? `— ${sources.length} windows —` : '— no sources —'}
                    </option>
                    {sources.map((src) => (
                        <option key={src.id} value={src.id}>
                            {src.name || '(untitled)'}
                        </option>
                    ))}
                </select>

                <button onClick={refreshSources} title="Refresh"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface-3 transition-colors">
                    <RefreshCw size={14} />
                </button>

                <div className="w-px h-4 bg-border" />

                <button onClick={handleToggleLive} disabled={!selectedId}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                     disabled:opacity-30 disabled:cursor-not-allowed
                     ${isLive ? 'bg-capture text-white hover:bg-capture-hover' : 'bg-surface-3 text-text hover:bg-surface-4'}`}>
                    {isLive ? '⏹ Stop' : '▶ Live'}
                </button>
            </div>

            {/* Preview area */}
            <Preview capture={capture} />
        </>
    );
}
