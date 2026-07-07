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
    <div className="fixed inset-x-3 bottom-3 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200 sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:-translate-x-1/2">
      <div ref={ref} className="mx-auto flex max-w-[520px] items-center gap-2 rounded-cu-lg border border-cu-border bg-cu-bg/95 px-3 py-2 shadow-cu-xl backdrop-blur-md sm:gap-3 sm:px-4">

        {/* Count */}
        <div className="flex items-center gap-2 pr-3 border-r border-cu-border/50">
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-cu-primary px-1.5 text-[11px] font-bold text-white shadow-sm animate-pulse-slow">
            {selectedCount}
          </span>
          <span className="text-[12px] font-bold text-cu-text-primary hidden sm:inline">Selected</span>
        </div>

        {/* Status change */}
        <div className="relative">
          <button
            onClick={() => setOpenStatus((v) => !v)}
            disabled={!canModifyTasks}
            title={!canModifyTasks ? 'Viewers cannot update task status' : 'Change status'}
            className="flex min-h-9 items-center gap-1.5 rounded-cu-md px-3 text-[11px] font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover/80 hover:text-cu-text-primary disabled:cursor-not-allowed disabled:opacity-50"
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
          className="flex min-h-9 items-center gap-1.5 rounded-cu-md px-3 text-[11px] font-bold text-cu-danger transition-colors hover:bg-cu-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={13} />
          <span className="hidden sm:inline">Delete</span>
        </button>

        {/* Clear */}
        <div className="pl-2 border-l border-cu-border/50">
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
