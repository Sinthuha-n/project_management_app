'use client';

import { AlertTriangle, BarChart2, FolderKanban, RefreshCw } from 'lucide-react';

interface BurndownStateProps {
  title: string;
  message: string;
  tone?: 'neutral' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

export default function BurndownState({ title, message, tone = 'neutral', actionLabel, onAction }: BurndownStateProps) {
  const Icon = tone === 'error' ? AlertTriangle : title.toLowerCase().includes('project') ? FolderKanban : BarChart2;
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-cu-border bg-cu-bg p-6 shadow-cu-sm">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-cu-primary/10 text-cu-primary'}`}>
          <Icon size={22} />
        </div>
        <h2 className="mt-3 text-[17px] font-bold text-cu-text-primary">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-cu-text-secondary">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-cu-primary px-3 py-2 text-[13px] font-semibold text-white shadow-cu-sm transition-opacity hover:opacity-90"
          >
            <RefreshCw size={14} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
