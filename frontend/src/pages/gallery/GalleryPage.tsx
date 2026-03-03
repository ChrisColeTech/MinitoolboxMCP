import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ImageOff, X, ExternalLink } from 'lucide-react';
import type { OutputFile } from '../../types/electron';
import { useAppStore } from '../../store/useAppStore';

export default function GalleryPage() {
    const setStatus = useAppStore((s) => s.setStatus);
    const [files, setFiles] = useState<OutputFile[]>([]);
    const [selected, setSelected] = useState<OutputFile | null>(null);
    const [loading, setLoading] = useState(true);

    const loadGallery = useCallback(async () => {
        if (!window.electronAPI) return;
        setLoading(true);
        try {
            const outputs = await window.electronAPI.listOutputs();
            setFiles(outputs);
            setStatus({ message: `${outputs.length} screenshots`, type: 'success' });
        } catch (err: any) {
            setStatus({ message: err.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [setStatus]);

    useEffect(() => { loadGallery(); }, [loadGallery]);

    // Close lightbox on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelected(null);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-surface-0">
                <span className="text-sm text-text-dim animate-pulse">Loading...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-2 bg-surface-1 border-b border-border shrink-0">
                <span className="text-xs font-medium text-text-muted">
                    {files.length} screenshot{files.length !== 1 ? 's' : ''}
                </span>
                <button onClick={loadGallery} title="Refresh"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface-3 transition-colors">
                    <RefreshCw size={14} />
                </button>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3">
                {files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-dim">
                        <ImageOff size={40} strokeWidth={1} className="mb-3 opacity-30" />
                        <p className="text-sm">No screenshots yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {files.map((f) => (
                            <button
                                key={f.name}
                                onClick={() => setSelected(f)}
                                className="group relative aspect-video bg-surface-2 rounded-lg overflow-hidden border border-border hover:border-accent/50 transition-all hover:scale-[1.02]"
                            >
                                <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-[10px] text-white truncate">{f.name}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Lightbox overlay ── */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
                    onClick={() => setSelected(null)}>
                    {/* Image */}
                    <img
                        src={selected.dataUrl}
                        alt={selected.name}
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
                    />

                    {/* Top bar */}
                    <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-3"
                        onClick={(e) => e.stopPropagation()}>
                        <p className="text-sm text-white/80 truncate max-w-lg">{selected.name}</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.electronAPI?.openExternal?.(selected.path)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                            >
                                <ExternalLink size={12} />
                                Open External
                            </button>
                            <button
                                onClick={() => setSelected(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Bottom info */}
                    <div className="absolute bottom-0 inset-x-0 flex items-center justify-center py-3"
                        onClick={(e) => e.stopPropagation()}>
                        <p className="text-[11px] text-white/40 truncate">{selected.path}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
