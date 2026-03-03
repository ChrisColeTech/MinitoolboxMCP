import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Image, Settings } from 'lucide-react';
import { useState } from 'react';
import type { Status } from '../types/electron';
import SettingsDialog from '../components/SettingsDialog';
import VscodeStatusBar from '../components/VscodeStatusBar';
import TitleBar from '../components/TitleBar';

const TOP_NAV = [
    { path: '/', icon: Camera, label: 'Capture' },
    { path: '/gallery', icon: Image, label: 'Gallery' },
];

export default function AppLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [status, setStatus] = useState<Status>({ message: 'Ready', type: 'idle' });

    return (
        <div className="flex flex-col h-screen select-none">
            <TitleBar />
            <div className="flex flex-1 overflow-hidden">
                {/* ── VS Code icon sidebar ── */}
                <nav className="w-12 bg-surface-1 border-r border-border flex flex-col items-center shrink-0">
                    {/* Top icons */}
                    <div className="flex flex-col items-center gap-1 pt-2">
                        {TOP_NAV.map((item) => {
                            const isActive = location.pathname === item.path;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    title={item.label}
                                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors relative
                    ${isActive
                                            ? 'text-accent'
                                            : 'text-text-dim hover:text-text-muted'
                                        }`}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
                                    )}
                                    <Icon size={20} strokeWidth={1.5} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Bottom: settings */}
                    <div className="mt-auto pb-2">
                        <button
                            onClick={() => setSettingsOpen(true)}
                            title="Settings"
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-text-dim hover:text-text-muted transition-colors"
                        >
                            <Settings size={20} strokeWidth={1.5} />
                        </button>
                    </div>
                </nav>

                {/* ── Main content ── */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Outlet context={{ status, setStatus }} />
                </main>
            </div>

            {/* ── VS Code status bar ── */}
            <VscodeStatusBar status={status} />

            {/* ── Settings Dialog ── */}
            {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
        </div>
    );
}
