import { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

export default function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const checkMaximized = async () => {
            if (window.electronAPI?.windowIsMaximized) {
                setIsMaximized(await window.electronAPI.windowIsMaximized());
            }
        };
        checkMaximized();
        // Check on resize
        const onResize = () => checkMaximized();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleMinimize = () => window.electronAPI?.windowMinimize();
    const handleMaximize = async () => {
        await window.electronAPI?.windowMaximize();
        setIsMaximized(await window.electronAPI?.windowIsMaximized());
    };
    const handleClose = () => window.electronAPI?.windowClose();

    return (
        <div className="flex items-center h-8 bg-surface-1 border-b border-border shrink-0 select-none"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            {/* App icon + title */}
            <div className="flex items-center gap-2 pl-3 pr-4">
                <div className="w-3.5 h-3.5 rounded-sm bg-accent flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">M</span>
                </div>
                <span className="text-[11px] text-text-dim font-medium">MinitoolboxMCP</span>
            </div>

            {/* Spacer (draggable) */}
            <div className="flex-1" />

            {/* Window controls */}
            <div className="flex items-center h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                    onClick={handleMinimize}
                    className="w-[46px] h-full flex items-center justify-center text-text-dim hover:bg-surface-3 transition-colors"
                >
                    <Minus size={14} strokeWidth={1.5} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="w-[46px] h-full flex items-center justify-center text-text-dim hover:bg-surface-3 transition-colors"
                >
                    {isMaximized
                        ? <Copy size={11} strokeWidth={1.5} className="rotate-180" />
                        : <Square size={11} strokeWidth={1.5} />
                    }
                </button>
                <button
                    onClick={handleClose}
                    className="w-[46px] h-full flex items-center justify-center text-text-dim hover:bg-[#e81123] hover:text-white transition-colors"
                >
                    <X size={15} strokeWidth={1.5} />
                </button>
            </div>
        </div>
    );
}
