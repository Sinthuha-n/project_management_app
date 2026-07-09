'use client';

import { FolderOpen, Upload } from 'lucide-react';

interface DmsHeaderProps {
    title: string;
    isTrashMode: boolean;
    onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DmsHeader({ title, isTrashMode, onUpload }: DmsHeaderProps) {
    return (
        <div className="flex flex-col gap-3 border-b border-cu-border bg-cu-bg px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-cu-lg border border-cu-border bg-cu-bg-secondary text-cu-primary">
                    <FolderOpen size={19} />
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cu-text-secondary">Documents</p>
                    <h1 className="truncate text-[20px] font-bold text-cu-text-primary">{title}</h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {!isTrashMode && (
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-cu-md bg-cu-primary px-4 py-2 text-sm font-semibold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover">
                        <Upload size={16} />
                        Upload
                        <input type="file" className="hidden" onChange={onUpload} />
                    </label>
                )}
            </div>
        </div>
    );
}
