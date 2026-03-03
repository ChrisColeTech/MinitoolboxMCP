import { useState, useEffect } from 'react';
import { Bell, Zap, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { Status } from '../types/electron';
import type { WsStatus } from '../hooks/useWebSocket';

interface Props {
    status: Status;
    wsStatus: WsStatus;
}

const WS_INDICATOR: Record<WsStatus, { icon: typeof Wifi; label: string; class: string }> = {
    connected: { icon: Wifi, label: 'Backend Connected', class: 'text-ok' },
    connecting: { icon: Loader2, label: 'Connecting...', class: 'text-warn animate-spin' },
    disconnected: { icon: WifiOff, label: 'Backend Disconnected', class: 'text-err' },
};

function useHealthCheck(intervalMs = 15000) {
    const [healthy, setHealthy] = useState<boolean | null>(null);
    useEffect(() => {
        let mounted = true;
        const check = async () => {
            try {
                const res = await fetch('http://localhost:3100/api/health', { method: 'POST' });
                if (mounted) setHealthy(res.ok);
            } catch {
                if (mounted) setHealthy(false);
            }
        };
        check();
        const id = setInterval(check, intervalMs);
        return () => { mounted = false; clearInterval(id); };
    }, [intervalMs]);
    return healthy;
}

export default function VscodeStatusBar({ status, wsStatus }: Props) {
    const ws = WS_INDICATOR[wsStatus];
    const WsIcon = ws.icon;
    const apiHealthy = useHealthCheck();

    const healthDot = apiHealthy === null
        ? 'bg-warn'
        : apiHealthy ? 'bg-ok' : 'bg-err';
    const healthLabel = apiHealthy === null
        ? 'API: checking...'
        : apiHealthy ? 'API OK' : 'API Unreachable';

    return (
        <div className="flex items-center h-6 px-2 bg-surface-1 border-t border-border text-[11px] font-medium shrink-0 gap-1">
            {/* Left: Health dot + WS status + app status */}
            <div className="flex items-center gap-3 text-text-muted">
                <span className="flex items-center gap-1.5" title={healthLabel}>
                    <span className={`inline-block w-2 h-2 rounded-full ${healthDot}`} />
                </span>
                <span className={`flex items-center gap-1 ${ws.class}`} title={ws.label}>
                    <WsIcon size={11} />
                </span>
                <span className="flex items-center gap-1">
                    <Zap size={11} className={status.type === 'error' ? 'text-err' : 'text-ok'} />
                    <span className="max-w-xs truncate">{status.message}</span>
                </span>
            </div>

            {/* Right */}
            <div className="ml-auto flex items-center gap-1 text-text-dim">
                <span className="px-1.5">v1.0.0</span>
                <button
                    className="w-6 h-5 flex items-center justify-center rounded bg-accent text-white hover:bg-accent-hover transition-colors"
                    title="Notifications"
                >
                    <Bell size={11} />
                </button>
            </div>
        </div>
    );
}
