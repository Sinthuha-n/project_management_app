'use client';

import { CheckCircle2, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import { UploadQueueItem } from '@/app/folders/components/types';
import { formatBytes } from '@/app/folders/components/dmsUtils';

interface Props {
    items: UploadQueueItem[];
    initializing: boolean;
    onCancel: (id: string) => void;
    onCancelRemaining: () => void;
    onRetry: (ids: string[]) => void;
    onClearFinished: () => void;
}

const statusLabel: Record<UploadQueueItem['status'], string> = {
    queued: 'Queued', uploading: 'Uploading', scanning: 'Scanning', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
};

export default function DmsUploadQueue({ items, initializing, onCancel, onCancelRemaining, onRetry, onClearFinished }: Props) {
    if (items.length === 0) return null;
    const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
    const uploadedBytes = items.reduce((sum, item) => sum + item.file.size * (item.progress / 100), 0);
    const overall = totalBytes ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
    const active = items.filter((item) => ['queued', 'uploading', 'scanning'].includes(item.status));
    const failed = items.filter((item) => ['failed', 'cancelled'].includes(item.status));
    const completed = items.filter((item) => item.status === 'completed').length;

    return (
        <aside className="fixed bottom-5 right-5 z-[var(--cu-z-toast)] flex max-h-[70vh] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-cu-lg border border-cu-border bg-cu-bg shadow-2xl">
            <div className="border-b border-cu-border bg-cu-bg-secondary px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-cu-text-primary">Document uploads</p>
                        <p className="text-[11px] text-cu-text-secondary">{completed} completed · {items.length} total</p>
                    </div>
                    <span className="text-xs font-bold text-cu-primary">{overall}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cu-bg-tertiary">
                    <div className="h-full rounded-full bg-cu-primary transition-all" style={{ width: `${overall}%` }} />
                </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {items.map((item) => (
                    <div key={item.id} className="rounded-cu-md border border-cu-border bg-cu-bg-secondary p-3">
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5">
                                {item.status === 'completed' ? <CheckCircle2 size={16} className="text-cu-success" />
                                    : item.status === 'failed' ? <XCircle size={16} className="text-cu-danger" />
                                    : ['uploading', 'scanning'].includes(item.status) ? <Loader2 size={16} className="animate-spin text-cu-primary" />
                                    : <div className="h-4 w-4 rounded-full border border-cu-border" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-cu-text-primary" title={item.file.name}>{item.file.name}</p>
                                <p className="mt-0.5 text-[10px] text-cu-text-tertiary">{formatBytes(item.file.size)} · {item.folderName} · {statusLabel[item.status]}</p>
                                {item.errorMessage && <p className="mt-1 text-[10px] text-cu-danger">{item.errorMessage}</p>}
                                {['uploading', 'scanning'].includes(item.status) && (
                                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-cu-bg-tertiary">
                                        <div className="h-full bg-cu-primary transition-all" style={{ width: `${item.progress}%` }} />
                                    </div>
                                )}
                            </div>
                            {['queued', 'uploading', 'scanning'].includes(item.status) && (
                                <button type="button" onClick={() => onCancel(item.id)} aria-label={`Cancel ${item.file.name}`} className="text-cu-text-tertiary hover:text-cu-danger"><X size={14} /></button>
                            )}
                            {['failed', 'cancelled'].includes(item.status) && (
                                <button type="button" onClick={() => onRetry([item.id])} aria-label={`Retry ${item.file.name}`} className="text-cu-text-tertiary hover:text-cu-primary"><RotateCcw size={14} /></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-cu-border px-3 py-2">
                {active.length > 0 && <button type="button" onClick={onCancelRemaining} className="rounded-cu-md px-3 py-1.5 text-xs font-semibold text-cu-danger hover:bg-cu-danger/10">Cancel remaining</button>}
                {failed.length > 0 && <button type="button" onClick={() => onRetry(failed.map((item) => item.id))} disabled={initializing} className="rounded-cu-md bg-cu-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Retry failed</button>}
                {active.length === 0 && <button type="button" onClick={onClearFinished} className="rounded-cu-md border border-cu-border px-3 py-1.5 text-xs font-semibold text-cu-text-secondary hover:bg-cu-hover">Clear finished</button>}
            </div>
        </aside>
    );
}
