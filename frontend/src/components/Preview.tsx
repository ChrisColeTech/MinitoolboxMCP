import type { CaptureResult } from '../types/electron';

interface PreviewProps {
    capture: CaptureResult | null;
}

export default function Preview({ capture }: PreviewProps) {
    if (capture) {
        return (
            <div className="flex-1 flex items-center justify-center bg-surface-0 overflow-hidden p-4">
                <img
                    src={capture.dataUrl}
                    alt={capture.name}
                    className="max-w-full max-h-full object-contain rounded shadow-2xl"
                />
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center bg-surface-0 overflow-hidden p-4">
            <div className="text-center text-text-muted">
                <span className="block text-5xl mb-3 opacity-30">🖥️</span>
                <p className="text-sm">Select a window to capture it</p>
            </div>
        </div>
    );
}
