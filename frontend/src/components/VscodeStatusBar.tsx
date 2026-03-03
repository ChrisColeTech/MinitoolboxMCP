import type { Status } from '../types/electron';
import { Bell, Zap } from 'lucide-react';

interface Props {
    status: Status;
}

export default function VscodeStatusBar({ status }: Props) {
    return (
        <div className="flex items-center h-6 px-2 bg-surface-1 border-t border-border text-[11px] font-medium shrink-0 gap-1">
            {/* Left side */}
            <div className="flex items-center gap-3 text-text-muted">
                <span className="flex items-center gap-1">
                    <Zap size={11} className={status.type === 'error' ? 'text-err' : 'text-ok'} />
                    <span className="max-w-xs truncate">{status.message}</span>
                </span>
            </div>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-1 text-text-dim">
                <span className="px-1.5">v1.0.0</span>

                {/* Notification bell — accent colored */}
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
