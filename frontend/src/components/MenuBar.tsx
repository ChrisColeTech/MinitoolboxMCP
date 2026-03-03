import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

// ── Types ──

interface MenuItem {
    label: string;
    shortcut?: string;
    action?: () => void;
    separator?: boolean;
    disabled?: boolean;
}

interface Menu {
    label: string;
    items: MenuItem[];
    /** When the current route matches this path, the menu label is highlighted */
    activePath?: string;
}

// ── Menu Definitions ──

function buildMenus(navigate: (path: string) => void): Menu[] {
    return [
        {
            label: 'File',
            items: [
                { label: 'Settings', shortcut: 'Ctrl+,', action: () => window.dispatchEvent(new CustomEvent('shortcut:settings')) },
                { separator: true, label: '' },
                { label: 'Reload Window', shortcut: 'Ctrl+R', action: () => window.location.reload() },
                { separator: true, label: '' },
                { label: 'Quit', shortcut: 'Ctrl+Q', action: () => window.electronAPI?.quitApp() },
            ],
        },
        {
            label: 'Capture',
            activePath: '/',
            items: [
                { label: 'Select Source', action: () => navigate('/') },
                { label: 'Refresh Sources', shortcut: 'F5', action: () => useAppStore.getState().refreshSources() },
                { separator: true, label: '' },
                { label: 'Start Live Preview', action: () => useAppStore.getState().startLive() },
                { label: 'Stop Live Preview', action: () => useAppStore.getState().stopLive() },
            ],
        },
        {
            label: 'Gallery',
            activePath: '/gallery',
            items: [
                { label: 'Open Gallery', shortcut: 'Ctrl+2', action: () => window.electronAPI?.openExternal?.('D:\\Projects\\MinitoolboxMCP\\outputs') },
            ],
        },
        {
            label: 'Tools',
            items: [
                { label: 'Toggle Developer Tools', shortcut: 'F12', action: () => window.electronAPI?.toggleDevTools() },
                { separator: true, label: '' },
                { label: 'Open Logs Folder', action: () => window.electronAPI?.openExternal?.('D:\\Projects\\MinitoolboxMCP\\logs') },
            ],
        },
    ];
}

// ── Component ──

export default function MenuBar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [openMenu, setOpenMenu] = useState<number | null>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const menus = buildMenus(navigate);

    // Close on click outside
    useEffect(() => {
        if (openMenu === null) return;
        const handler = (e: MouseEvent) => {
            if (barRef.current && !barRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openMenu]);

    // Close on Escape
    useEffect(() => {
        if (openMenu === null) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpenMenu(null);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [openMenu]);

    return (
        <div ref={barRef} className="flex items-center h-full"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            {menus.map((menu, i) => (
                <div key={menu.label} className="relative">
                    <button
                        onMouseDown={() => setOpenMenu(openMenu === i ? null : i)}
                        onMouseEnter={() => openMenu !== null && setOpenMenu(i)}
                        className={`px-2.5 h-7 text-[11px] rounded-[3px] transition-colors
                            ${openMenu === i
                                ? 'bg-surface-3 text-text'
                                : menu.activePath && location.pathname === menu.activePath
                                    ? 'text-accent'
                                    : 'text-text-dim hover:text-text hover:bg-surface-2'
                            }`}
                    >
                        {menu.label}
                        {menu.activePath && location.pathname === menu.activePath && openMenu !== i && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-accent rounded-full" />
                        )}
                    </button>

                    {openMenu === i && (
                        <div className="absolute top-7 left-0 z-50 min-w-[200px] py-1 bg-surface-2 border border-border rounded-md shadow-xl"
                            style={{ backdropFilter: 'blur(12px)' }}>
                            {menu.items.map((item, j) =>
                                item.separator ? (
                                    <div key={j} className="my-1 mx-2 h-px bg-border" />
                                ) : (
                                    <button
                                        key={j}
                                        disabled={item.disabled}
                                        onClick={() => {
                                            item.action?.();
                                            setOpenMenu(null);
                                        }}
                                        className="w-full flex items-center justify-between px-3 py-1 text-[11px] text-text hover:bg-accent/20 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <span>{item.label}</span>
                                        {item.shortcut && (
                                            <span className="text-text-dim text-[10px] ml-6">{item.shortcut}</span>
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
