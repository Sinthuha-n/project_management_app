'use client';

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import type { CalendarFilters, CalendarView } from '../types';
import FilterDropdown from './FilterDropdown';
import BottomSheet from '@/components/shared/BottomSheet';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';

interface CalendarToolbarProps {
  view: CalendarView;
  currentLabel: string;
  filters: CalendarFilters;
  assigneeOptions: string[];
  typeOptions: string[];
  statusOptions: string[];
  moreFilterOptions: string[];
  onViewChange: (value: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSearchChange: (value: string) => void;
  onAssigneesChange: (values: string[]) => void;
  onTypesChange: (values: string[]) => void;
  onStatusesChange: (values: string[]) => void;
  onMoreFiltersChange: (values: string[]) => void;
}

const VIEWS: Array<{ value: CalendarView; label: string }> = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'Agenda' },
];

export default function CalendarToolbar({
  view,
  currentLabel,
  filters,
  assigneeOptions,
  typeOptions,
  statusOptions,
  moreFilterOptions,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onSearchChange,
  onAssigneesChange,
  onTypesChange,
  onStatusesChange,
  onMoreFiltersChange,
}: CalendarToolbarProps) {
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.assignees.length,
    filters.types.length,
    filters.statuses.length,
    filters.moreFilters.length,
  ].reduce((total, count) => total + count, 0);

  const clearFilters = () => {
    onSearchChange('');
    onAssigneesChange([]);
    onTypesChange([]);
    onStatusesChange([]);
    onMoreFiltersChange([]);
  };

  return (
    <TooltipProvider>
      <div className="rounded-xl glass-panel p-3 shadow-cu-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
            <div className="relative min-w-0 flex-1 md:max-w-sm">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted" />
              <input
                value={filters.search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search tasks, sprints, assignees"
                className="h-10 w-full rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] pl-9 pr-9 text-sm text-cu-text-primary outline-none transition-all placeholder:text-cu-text-muted focus:border-cu-primary focus:bg-[rgba(255,255,255,0.4)] dark:focus:bg-[rgba(11,17,32,0.4)] focus:ring-2 focus:ring-cu-primary/15 backdrop-blur-sm"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-cu-text-muted hover:bg-cu-hover/40 hover:text-cu-text-primary"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="hidden items-center gap-2 md:flex md:flex-wrap">
              <FilterDropdown label="Assignee" options={assigneeOptions} selected={filters.assignees} onChange={onAssigneesChange} searchablePlaceholder="Search assignee" widthClassName="w-40" />
              <FilterDropdown label="Type" options={typeOptions} selected={filters.types} onChange={onTypesChange} searchablePlaceholder="Search type" widthClassName="w-40" />
              <FilterDropdown label="Status" options={statusOptions} selected={filters.statuses} onChange={onStatusesChange} searchablePlaceholder="Search status" widthClassName="w-40" />
              <FilterDropdown label="More" options={moreFilterOptions} selected={filters.moreFilters} onChange={onMoreFiltersChange} searchablePlaceholder="Search filters" widthClassName="w-40" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToday}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-[rgba(245,247,250,0.6)] dark:hover:bg-[rgba(24,34,53,0.6)] backdrop-blur-sm"
            >
              <CalendarDays size={15} />
              Today
            </button>

            <div className="flex items-center rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] p-1 backdrop-blur-sm">
              <Tooltip content="Previous">
                <button
                  type="button"
                  onClick={onPrev}
                  aria-label="Previous calendar range"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-cu-text-secondary transition-colors hover:bg-[rgba(255,255,255,0.4)] dark:hover:bg-[rgba(11,17,32,0.4)] hover:text-cu-primary"
                >
                  <ChevronLeft size={17} />
                </button>
              </Tooltip>
              <div className="min-w-[8.5rem] px-2 text-center text-sm font-bold text-cu-text-primary sm:min-w-[11rem]">
                {currentLabel}
              </div>
              <Tooltip content="Next">
                <button
                  type="button"
                  onClick={onNext}
                  aria-label="Next calendar range"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-cu-text-secondary transition-colors hover:bg-[rgba(255,255,255,0.4)] dark:hover:bg-[rgba(11,17,32,0.4)] hover:text-cu-primary"
                >
                  <ChevronRight size={17} />
                </button>
              </Tooltip>
            </div>

            <div className="hidden rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] p-1 sm:inline-flex backdrop-blur-sm">
              {VIEWS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onViewChange(item.value)}
                  className={[
                    'h-8 rounded-md px-3 text-xs font-bold transition-all duration-200',
                    view === item.value ? 'bg-[rgba(21,93,252,0.85)] text-white shadow-cu-sm backdrop-blur-sm border border-[rgba(255,255,255,0.2)]' : 'text-cu-text-secondary hover:bg-[rgba(255,255,255,0.4)] dark:hover:bg-[rgba(11,17,32,0.4)] hover:text-cu-text-primary',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-[rgba(245,247,250,0.6)] dark:hover:bg-[rgba(24,34,53,0.6)] backdrop-blur-sm md:hidden"
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cu-primary px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 flex rounded-lg border border-[rgba(232,232,237,0.5)] dark:border-[rgba(39,52,73,0.5)] bg-[rgba(247,248,250,0.4)] dark:bg-[rgba(17,24,39,0.4)] p-1 sm:hidden backdrop-blur-sm">
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onViewChange(item.value)}
              className={[
                'h-9 flex-1 rounded-md text-xs font-bold transition-all duration-200',
                view === item.value ? 'bg-[rgba(21,93,252,0.85)] text-white shadow-cu-sm backdrop-blur-sm border border-[rgba(255,255,255,0.2)]' : 'text-cu-text-secondary hover:bg-[rgba(255,255,255,0.4)] dark:hover:bg-[rgba(11,17,32,0.4)] hover:text-cu-text-primary',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} title="Calendar filters" snapPoint="full">
          <div className="space-y-5 px-4 pb-8 pt-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-cu-text-muted">Search</label>
              <input
                value={filters.search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search calendar"
                className="h-10 w-full rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-sm text-cu-text-primary outline-none placeholder:text-cu-text-muted focus:border-cu-primary"
              />
            </div>

            <div className="space-y-4">
              <FilterDropdown label="Assignee" options={assigneeOptions} selected={filters.assignees} onChange={onAssigneesChange} searchablePlaceholder="Search assignee" widthClassName="w-full" />
              <FilterDropdown label="Type" options={typeOptions} selected={filters.types} onChange={onTypesChange} searchablePlaceholder="Search type" widthClassName="w-full" />
              <FilterDropdown label="Status" options={statusOptions} selected={filters.statuses} onChange={onStatusesChange} searchablePlaceholder="Search status" widthClassName="w-full" />
              <FilterDropdown label="More filters" options={moreFilterOptions} selected={filters.moreFilters} onChange={onMoreFiltersChange} searchablePlaceholder="Search more filters" widthClassName="w-full" />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearFilters}
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
      </div>
    </TooltipProvider>
  );
}
