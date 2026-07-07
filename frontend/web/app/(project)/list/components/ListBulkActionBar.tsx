'use client';

import { ChevronDown, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ListBulkActionBarProps {
  selectedCount: number;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onClear: () => void;
  canModifyTasks?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW',   label: 'In Review' },
  { value: 'DONE',        label: 'Done' },
];

export default function ListBulkActionBar({
  selectedCount,
  onStatusChange,
  onDelete,
  onClear,
  canModifyTasks = true,
}: ListBulkActionBarProps) {
  const [openStatus, setOpenStatus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenStatus(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-50 animate-in slide-in-from-bottom-4 fade-in duration-200 sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:-translate-x-1/2">
      <div ref={ref} className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-1 rounded-cu-lg border border-cu-border bg-cu-bg/95 px-2 py-2 shadow-cu-xl backdrop-blur-md min-[360px]:gap-2 min-[360px]:px-3 sm:gap-3 sm:px-4">

        {/* Count */}
        <div className="flex shrink-0 items-center gap-1.5 border-r border-cu-border/50 pr-2 min-[360px]:gap-2 min-[360px]:pr-3">
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-cu-primary px-1.5 text-[11px] font-bold text-white shadow-sm animate-pulse-slow">
            {selectedCount}
          </span>
          <span className="hidden text-[12px] font-bold text-cu-text-primary min-[360px]:inline">Selected</span>
        </div>

        {/* Status change */}
        <div className="relative min-w-0">
          <button
            onClick={() => setOpenStatus((v) => !v)}
            disabled={!canModifyTasks}
            title={!canModifyTasks ? 'Viewers cannot update task status' : 'Change status'}
            className="flex min-h-9 items-center gap-1 rounded-cu-md px-2 text-[11px] font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover/80 hover:text-cu-text-primary disabled:cursor-not-allowed disabled:opacity-50 min-[360px]:gap-1.5 min-[360px]:px-3"
          >
            <span>Status</span>
            <ChevronDown size={11} className="text-cu-text-muted" />
          </button>
          {openStatus && (
            <div className="absolute bottom-11 left-0 min-w-[140px] rounded-xl border border-cu-border bg-cu-bg/95 backdrop-blur-md shadow-cu-xl overflow-hidden py-1 animate-slide-up">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onStatusChange(opt.value); setOpenStatus(false); }}
                  className="flex w-full items-center px-3.5 py-2 text-[12px] font-semibold text-cu-text-primary hover:bg-cu-hover transition-colors cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          disabled={!canModifyTasks}
          title={!canModifyTasks ? 'Viewers cannot delete tasks' : 'Delete selected tasks'}
          className="flex min-h-9 items-center gap-1 rounded-cu-md px-2 text-[11px] font-bold text-cu-danger transition-colors hover:bg-cu-danger/10 disabled:cursor-not-allowed disabled:opacity-50 min-[360px]:gap-1.5 min-[360px]:px-3"
        >
          <Trash2 size={13} />
          <span className="hidden min-[360px]:inline">Delete</span>
        </button>

        {/* Clear */}
        <div className="shrink-0 border-l border-cu-border/50 pl-1 min-[360px]:pl-2">
          <button
            onClick={onClear}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-all duration-200 hover:rotate-90 cursor-pointer"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
