import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import Preview from '../../components/Preview';
import { useAppStore } from '../../store/useAppStore';

export default function IndexPage() {
    const {
        sources, selectedSourceId, capture, isLive,
        refreshSources, setSelectedSourceId, captureOnce, startLive, stopLive, setCapture,
    } = useAppStore();

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initial fetch + 30-second polling
    useEffect(() => {
        refreshSources();
        pollRef.current = setInterval(refreshSources, 30_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [refreshSources]);

    // Cleanup live on unmount
    useEffect(() => () => stopLive(), [stopLive]);

    const handleSourceChange = (id: string) => {
        stopLive();
        setSelectedSourceId(id);
        if (id) captureOnce(id);
        else setCapture(null);
    };

    const handleToggleLive = () => {
        isLive ? stopLive() : startLive(selectedSourceId);
    };

    return (
        <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-surface-1 border-b border-border shrink-0">
                <select
                    value={selectedSourceId}
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

                <button onClick={handleToggleLive} disabled={!selectedSourceId}
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
