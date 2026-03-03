import { useState, useEffect } from 'react';
import { X, FolderOpen, Trash2, Settings as SettingsIcon } from 'lucide-react';

interface Props {
    onClose: () => void;
}

type Tab = 'general';

export default function SettingsDialog({ onClose }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [outputDir, setOutputDir] = useState('');
    const [clearing, setClearing] = useState(false);
    const [clearResult, setClearResult] = useState('');

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getOutputDir().then(setOutputDir);
        }
    }, []);

    const handleChangeOutputDir = async () => {
        if (!window.electronAPI) return;
        const newDir = await window.electronAPI.setOutputDir();
        setOutputDir(newDir);
    };

    const handleClearCache = async () => {
        if (!window.electronAPI) return;
        setClearing(true);
        setClearResult('');
        const count = await window.electronAPI.clearCache();
        setClearResult(`Deleted ${count} screenshot${count !== 1 ? 's' : ''}.`);
        setClearing(false);
    };

    const tabs: { id: Tab; label: string; icon: typeof SettingsIcon }[] = [
        { id: 'general', label: 'General', icon: SettingsIcon },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            {/* Dialog */}
            <div className="relative w-[640px] h-[440px] bg-surface-2 rounded-xl border border-border shadow-2xl flex overflow-hidden">
                {/* ── Acrylic sidebar ── */}
                <div className="w-48 bg-surface-1/80 backdrop-blur-xl border-r border-border flex flex-col">
                    <div className="px-4 pt-4 pb-2">
                        <h2 className="text-sm font-semibold text-text">Settings</h2>
                    </div>
                    <nav className="flex-1 px-2 py-1 flex flex-col gap-0.5">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${isActive
                                            ? 'bg-accent-dim text-accent font-medium'
                                            : 'text-text-muted hover:bg-surface-3 hover:text-text'
                                        }`}
                                >
                                    <Icon size={16} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold text-text">
                            {tabs.find((t) => t.id === activeTab)?.label}
                        </h3>
                        <button
                            onClick={onClose}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* General tab */}
                    {activeTab === 'general' && (
                        <div className="flex-1 px-5 py-4 overflow-y-auto">
                            <div className="space-y-6">
                                {/* Output folder */}
                                <div>
                                    <label className="block text-xs font-medium text-text-muted mb-2">
                                        Output Folder
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 px-3 py-2 bg-surface-0 border border-border rounded-lg text-xs text-text-muted truncate">
                                            {outputDir || '—'}
                                        </div>
                                        <button
                                            onClick={handleChangeOutputDir}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-surface-3 hover:bg-surface-4 text-text text-xs font-medium rounded-lg transition-colors"
                                        >
                                            <FolderOpen size={14} />
                                            Browse
                                        </button>
                                    </div>
                                </div>

                                {/* Clear cache */}
                                <div>
                                    <label className="block text-xs font-medium text-text-muted mb-2">
                                        Cache
                                    </label>
                                    <button
                                        onClick={handleClearCache}
                                        disabled={clearing}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-err/10 hover:bg-err/20 text-err text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={14} />
                                        {clearing ? 'Clearing...' : 'Clear All Screenshots'}
                                    </button>
                                    <p className="text-[11px] text-text-dim mt-1.5">
                                        {clearResult || 'Deletes all PNG files from the output folder.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
