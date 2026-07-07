'use client';

import { ChevronDown, RefreshCw, RotateCcw } from 'lucide-react';
import type { RefObject } from 'react';
import { STATUS_LABEL, STATUS_STYLE, type BurndownSprint } from './SprintSelector';

interface BurndownCommandBarProps {
  sprints: BurndownSprint[];
  selectedSprint: BurndownSprint | undefined;
  selectedSprintId: number | null;
  sprintDropOpen: boolean;
  filterFrom: string;
  filterTo: string;
  loading: boolean;
  dropdownRef: RefObject<HTMLDivElement | null>;
  onToggleDropdown: () => void;
  onSelectSprint: (sprint: BurndownSprint) => void;
  onFilterFromChange: (value: string) => void;
  onFilterToChange: (value: string) => void;
  onResetRange: () => void;
  onRefresh: () => void;
}

export default function BurndownCommandBar({
  sprints,
  selectedSprint,
  selectedSprintId,
  sprintDropOpen,
  filterFrom,
  filterTo,
  loading,
  dropdownRef,
  onToggleDropdown,
  onSelectSprint,
  onFilterFromChange,
  onFilterToChange,
  onResetRange,
  onRefresh,
}: BurndownCommandBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-cu-border bg-cu-bg px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={onToggleDropdown}
            className="flex max-w-full items-center gap-2 rounded-md border border-cu-border bg-cu-bg px-3 py-2 text-[13px] font-semibold text-cu-text-primary shadow-cu-sm transition-colors hover:border-cu-primary/40 hover:bg-cu-hover"
          >
            <span className="max-w-[220px] truncate">{selectedSprint ? selectedSprint.name : 'Select Sprint'}</span>
            {selectedSprint && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[selectedSprint.status]}`}>
                {STATUS_LABEL[selectedSprint.status]}
              </span>
            )}
            <ChevronDown size={15} className="shrink-0 text-cu-text-muted" />
          </button>

          {sprintDropOpen && (
            <div className="absolute left-0 top-10 z-50 max-h-[320px] min-w-[260px] overflow-auto rounded-lg border border-cu-border bg-cu-bg shadow-cu-xl">
              {sprints.map((sprint) => (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => onSelectSprint(sprint)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-cu-hover ${sprint.id === selectedSprintId ? 'bg-cu-primary/10 font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                >
                  <span className="truncate">{sprint.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[sprint.status]}`}>
                    {STATUS_LABEL[sprint.status]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-md border border-cu-border bg-cu-bg-secondary px-2 py-1.5">
          <input
            aria-label="Burndown start date"
            type="date"
            value={filterFrom}
            max={filterTo || undefined}
            onChange={(event) => onFilterFromChange(event.target.value)}
            className="border-none bg-transparent text-[12px] text-cu-text-primary outline-none"
          />
          <span className="text-[12px] text-cu-text-muted">to</span>
          <input
            aria-label="Burndown end date"
            type="date"
            value={filterTo}
            min={filterFrom || undefined}
            onChange={(event) => onFilterToChange(event.target.value)}
            className="border-none bg-transparent text-[12px] text-cu-text-primary outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResetRange}
          disabled={!selectedSprint?.startDate || !selectedSprint?.endDate}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cu-border bg-cu-bg text-cu-text-secondary transition-colors hover:border-cu-primary/40 hover:bg-cu-hover disabled:cursor-not-allowed disabled:opacity-50"
          title="Reset to sprint dates"
          aria-label="Reset to sprint dates"
        >
          <RotateCcw size={15} />
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || !selectedSprintId}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cu-border bg-cu-bg text-cu-text-secondary transition-colors hover:border-cu-primary/40 hover:bg-cu-hover disabled:cursor-not-allowed disabled:opacity-50"
          title="Refresh burndown"
          aria-label="Refresh burndown"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}
