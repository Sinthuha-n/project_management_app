'use client';

import React, { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Search,
  X,
} from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';
import type { TimelineFilters, TimelineGroupBy, TimelineZoom } from '../utils/timeline-utils';

const ZOOM_OPTIONS: Array<{ value: TimelineZoom; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const GROUP_OPTIONS: Array<{ value: TimelineGroupBy; label: string }> = [
  { value: 'none', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'milestone', label: 'Milestone' },
];

interface TimelineControlsProps {
  zoom: TimelineZoom;
  onZoomChange: (value: TimelineZoom) => void;
  groupBy: TimelineGroupBy;
  onGroupByChange: (value: TimelineGroupBy) => void;
  filters: TimelineFilters;
  onFiltersChange: (value: TimelineFilters) => void;
  assigneeOptions: string[];
  milestoneOptions: Array<{ id: number; name: string }>;
  currentLabel: string;
  activeFilterCount: number;
  onPreviousRange: () => void;
  onNextRange: () => void;
  onToday: () => void;
  onClearFilters: () => void;
}

function SelectControl({
  label,
  icon,
  value,
  onChange,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex h-10 items-center rounded-lg border border-cu-border bg-cu-bg-secondary pl-3 pr-8 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover">
      <span className="mr-2 text-cu-text-muted">{icon}</span>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[11rem] appearance-none bg-transparent text-sm font-bold outline-none"
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-cu-text-muted" />
    </label>
  );
}

export default function TimelineControls({
  zoom,
  onZoomChange,
  groupBy,
  onGroupByChange,
  filters,
  onFiltersChange,
  assigneeOptions,
  milestoneOptions,
  currentLabel,
  activeFilterCount,
  onPreviousRange,
  onNextRange,
  onToday,
  onClearFilters,
}: TimelineControlsProps) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const patchFilters = (updates: Partial<TimelineFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const renderFilterFields = () => (
    <>
      <SelectControl
        label="Assignee"
        icon={<Filter size={15} />}
        value={filters.assignee}
        onChange={(value) => patchFilters({ assignee: value })}
      >
        <option value="">All assignees</option>
        {assigneeOptions.map((assignee) => (
          <option key={assignee} value={assignee}>{assignee}</option>
        ))}
      </SelectControl>

      <SelectControl
        label="Milestone"
        icon={<CalendarDays size={15} />}
        value={filters.milestone}
        onChange={(value) => patchFilters({ milestone: value })}
      >
        <option value="">All milestones</option>
        <option value="__none__">No milestone</option>
        {milestoneOptions.map((milestone) => (
          <option key={milestone.id} value={String(milestone.id)}>{milestone.name}</option>
        ))}
      </SelectControl>

      <button
        type="button"
        onClick={() => patchFilters({ hideWeekends: !filters.hideWeekends })}
        className={[
          'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors',
          filters.hideWeekends
            ? 'border-cu-primary/30 bg-cu-primary/10 text-cu-primary'
            : 'border-cu-border bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover',
        ].join(' ')}
      >
        {filters.hideWeekends ? <Eye size={15} /> : <EyeOff size={15} />}
        Weekends
      </button>

      <button
        type="button"
        onClick={() => patchFilters({ showDone: !filters.showDone })}
        className={[
          'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors',
          filters.showDone
            ? 'border-cu-primary/30 bg-cu-primary/10 text-cu-primary'
            : 'border-cu-border bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover',
        ].join(' ')}
      >
        {filters.showDone ? <Eye size={15} /> : <EyeOff size={15} />}
        Done
      </button>
    </>
  );

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-cu-border bg-cu-bg p-3 shadow-cu-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted" />
              <input
                value={filters.search}
                onChange={(event) => patchFilters({ search: event.target.value })}
                placeholder="Search tasks, assignees, milestones"
                className="h-10 w-full rounded-lg border border-cu-border bg-cu-bg-secondary pl-9 pr-9 text-sm text-cu-text-primary outline-none transition-colors placeholder:text-cu-text-muted focus:border-cu-primary focus:bg-cu-bg focus:ring-2 focus:ring-cu-primary/15"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => patchFilters({ search: '' })}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-cu-text-muted hover:bg-cu-hover hover:text-cu-text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="hidden items-center gap-2 xl:flex">
              {renderFilterFields()}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex h-10 items-center rounded-lg border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToday}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover"
            >
              <CalendarDays size={15} />
              Today
            </button>

            <div className="flex items-center rounded-lg border border-cu-border bg-cu-bg-secondary p-1">
              <Tooltip content="Previous range">
                <button
                  type="button"
                  onClick={onPreviousRange}
                  aria-label="Previous timeline range"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-cu-text-secondary transition-colors hover:bg-cu-bg hover:text-cu-primary"
                >
                  <ChevronLeft size={17} />
                </button>
              </Tooltip>
              <div className="min-w-[8.5rem] px-2 text-center text-sm font-bold text-cu-text-primary sm:min-w-[12rem]">
                {currentLabel}
              </div>
              <Tooltip content="Next range">
                <button
                  type="button"
                  onClick={onNextRange}
                  aria-label="Next timeline range"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-cu-text-secondary transition-colors hover:bg-cu-bg hover:text-cu-primary"
                >
                  <ChevronRight size={17} />
                </button>
              </Tooltip>
            </div>

            <SelectControl
              label="Group by"
              icon={<Layers size={15} />}
              value={groupBy}
              onChange={(value) => onGroupByChange(value as TimelineGroupBy)}
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectControl>

            <div className="hidden rounded-lg border border-cu-border bg-cu-bg-secondary p-1 sm:inline-flex">
              {ZOOM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onZoomChange(option.value)}
                  className={[
                    'h-8 rounded-md px-3 text-xs font-bold capitalize transition-colors',
                    zoom === option.value ? 'bg-cu-primary text-white shadow-cu-sm' : 'text-cu-text-secondary hover:bg-cu-bg hover:text-cu-text-primary',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover xl:hidden"
            >
              <Filter size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cu-primary px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 flex rounded-lg border border-cu-border bg-cu-bg-secondary p-1 sm:hidden">
          {ZOOM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onZoomChange(option.value)}
              className={[
                'h-9 flex-1 rounded-md text-xs font-bold transition-colors',
                zoom === option.value ? 'bg-cu-primary text-white shadow-cu-sm' : 'text-cu-text-secondary hover:bg-cu-bg hover:text-cu-text-primary',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Timeline filters" snapPoint="full">
        <div className="space-y-5 pb-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-cu-text-muted">Search</label>
            <input
              value={filters.search}
              onChange={(event) => patchFilters({ search: event.target.value })}
              placeholder="Search timeline"
              className="h-10 w-full rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-sm text-cu-text-primary outline-none placeholder:text-cu-text-muted focus:border-cu-primary"
            />
          </div>
          <div className="grid gap-3">
            {renderFilterFields()}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClearFilters}
              className="h-10 flex-1 rounded-lg border border-cu-border bg-cu-bg text-sm font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="h-10 flex-1 rounded-lg bg-cu-primary text-sm font-bold text-white transition-colors hover:bg-cu-primary-hover"
            >
              Apply
            </button>
          </div>
        </div>
      </BottomSheet>
    </TooltipProvider>
  );
}
