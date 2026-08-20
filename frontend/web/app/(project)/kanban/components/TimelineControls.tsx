'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Layers,
  Search,
  User,
  X,
} from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';
import OverlayPortal from '@/components/ui/OverlayPortal';
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

const ASSIGNEE_MENU_WIDTH = 240;
const ASSIGNEE_MENU_MAX_HEIGHT = 288;
const VIEWPORT_MARGIN = 8;

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
  className = '',
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`relative inline-flex h-10 min-w-[10.5rem] max-w-[15rem] shrink-0 items-center rounded-lg border border-cu-border bg-cu-bg-secondary pl-3 pr-8 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover ${className}`}>
      <span className="mr-2 shrink-0 text-cu-text-muted">{icon}</span>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 max-w-[11rem] appearance-none bg-transparent text-sm font-bold outline-none"
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-cu-text-muted" />
    </label>
  );
}

function MultiAssigneeSelect({
  assigneeOptions,
  selectedAssignees,
  onChange,
  className = '',
}: {
  assigneeOptions: string[];
  selectedAssignees: string[];
  onChange: (assignees: string[]) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current?.querySelector('button');
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const gap = 4;
    const width = Math.min(ASSIGNEE_MENU_WIDTH, Math.max(160, viewportWidth - VIEWPORT_MARGIN * 2));
    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN - gap;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - gap;
    const opensBelow = spaceBelow >= Math.min(ASSIGNEE_MENU_MAX_HEIGHT, spaceAbove);
    const availableHeight = Math.max(96, opensBelow ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(ASSIGNEE_MENU_MAX_HEIGHT, availableHeight);
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));
    const top = opensBelow
      ? Math.min(rect.bottom + gap, viewportHeight - maxHeight - VIEWPORT_MARGIN)
      : Math.max(VIEWPORT_MARGIN, rect.top - gap - maxHeight);

    setMenuPosition({ top, left, width, maxHeight });
  }, []);

  const handleToggleOpen = useCallback(() => {
    setIsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        requestAnimationFrame(updateMenuPosition);
      }
      return nextOpen;
    });
  }, [updateMenuPosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target) ?? false;
      const clickedMenu = menuRef.current?.contains(target) ?? false;
      if (!clickedTrigger && !clickedMenu) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const toggleAssignee = (name: string) => {
    if (selectedAssignees.includes(name)) {
      onChange(selectedAssignees.filter((a) => a !== name));
    } else {
      onChange([...selectedAssignees, name]);
    }
  };

  const isUnassignedSelected = selectedAssignees.includes('Unassigned');

  const filteredOptions = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return assigneeOptions;
    return assigneeOptions.filter((opt) => opt.toLowerCase().includes(s));
  }, [assigneeOptions, search]);

  const displayText =
    selectedAssignees.length === 0
      ? 'All assignees'
      : selectedAssignees.length === 1
      ? selectedAssignees[0]
      : `${selectedAssignees.length} assignees`;

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`relative inline-flex h-10 w-full min-w-[10.5rem] max-w-[15rem] shrink-0 items-center justify-between rounded-lg border pl-3 pr-3 text-sm font-bold transition-colors ${
          selectedAssignees.length > 0
            ? 'border-cu-primary/40 bg-cu-primary/10 text-cu-primary'
            : 'border-cu-border bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Filter size={15} className={selectedAssignees.length > 0 ? 'text-cu-primary' : 'text-cu-text-muted'} />
          <span className="truncate">{displayText}</span>
        </div>
        <div className="flex items-center gap-1">
          {selectedAssignees.length > 1 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cu-primary px-1 text-[10px] font-bold text-white">
              {selectedAssignees.length}
            </span>
          )}
          <ChevronDown size={14} className="text-cu-text-muted" />
        </div>
      </button>

      {isOpen && menuPosition && (
        <OverlayPortal>
        <div
          ref={menuRef}
          data-testid="timeline-assignee-dropdown"
          className="fixed z-[var(--cu-z-modal-popover)] overflow-y-auto rounded-xl border border-cu-border bg-cu-bg p-1.5 shadow-cu-lg animate-in fade-in-50 zoom-in-95"
          style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: menuPosition.maxHeight }}
        >
          {assigneeOptions.length > 5 && (
            <div className="p-1 mb-1 border-b border-cu-border-light">
              <input
                type="text"
                placeholder="Filter assignees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 px-2 text-xs rounded-md bg-cu-bg-secondary border border-cu-border text-cu-text-primary placeholder:text-cu-text-muted outline-none focus:border-cu-primary"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setIsOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              selectedAssignees.length === 0
                ? 'bg-cu-primary/10 text-cu-primary font-bold'
                : 'text-cu-text-secondary hover:bg-cu-hover'
            }`}
          >
            <span>All assignees</span>
            {selectedAssignees.length === 0 && <span className="text-xs">✓</span>}
          </button>
          <div className="my-1 border-t border-cu-border-light" />
          <button
            type="button"
            onClick={() => toggleAssignee('Unassigned')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              isUnassignedSelected
                ? 'bg-cu-primary/10 text-cu-primary font-bold'
                : 'text-cu-text-primary hover:bg-cu-hover'
            }`}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-cu-bg-secondary border border-cu-border text-[10px] text-cu-text-muted font-bold">
                <User size={11} />
              </span>
              <span>Unassigned</span>
            </div>
            <input
              type="checkbox"
              checked={isUnassignedSelected}
              readOnly
              className="h-3.5 w-3.5 rounded border-cu-border text-cu-primary pointer-events-none"
            />
          </button>
          {filteredOptions.map((name) => {
            if (name === 'Unassigned') return null;
            const isSelected = selectedAssignees.includes(name);
            const initial = name.charAt(0).toUpperCase();
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleAssignee(name)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-cu-primary/10 text-cu-primary font-bold'
                    : 'text-cu-text-primary hover:bg-cu-hover'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[9px] font-bold text-white shadow-xs">
                    {initial}
                  </span>
                  <span className="truncate">{name}</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="h-3.5 w-3.5 rounded border-cu-border text-cu-primary pointer-events-none"
                />
              </button>
            );
          })}
        </div>
        </OverlayPortal>
      )}
    </div>
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

  const selectedAssignees = useMemo(() => {
    if (filters.assignees && filters.assignees.length > 0) return filters.assignees;
    if (filters.assignee) return [filters.assignee];
    return [];
  }, [filters.assignees, filters.assignee]);

  const patchFilters = (updates: Partial<TimelineFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const handleAssigneesChange = (assignees: string[]) => {
    patchFilters({
      assignees,
      assignee: assignees.length === 1 ? assignees[0] : '',
    });
  };

  const renderFilterFields = ({ stretch = false }: { stretch?: boolean } = {}) => (
    <>
      <MultiAssigneeSelect
        assigneeOptions={assigneeOptions}
        selectedAssignees={selectedAssignees}
        onChange={handleAssigneesChange}
        className={stretch ? 'w-full max-w-full' : ''}
      />

      <SelectControl
        label="Milestone"
        icon={<CalendarDays size={15} />}
        value={filters.milestone}
        onChange={(value) => patchFilters({ milestone: value })}
        className={stretch ? 'w-full max-w-full' : ''}
      >
        <option value="">All milestones</option>
        <option value="__none__">No milestone</option>
        {milestoneOptions.map((milestone) => (
          <option key={milestone.id} value={String(milestone.id)}>{milestone.name}</option>
        ))}
      </SelectControl>

      <SelectControl
        label="Schedule"
        icon={<CalendarClock size={15} />}
        value={filters.schedule}
        onChange={(value) => patchFilters({ schedule: value as TimelineFilters['schedule'] })}
        className={stretch ? 'w-full max-w-full' : ''}
      >
        <option value="">All schedules</option>
        <option value="scheduled">Scheduled</option>
        <option value="unscheduled">Unscheduled</option>
      </SelectControl>

      <SelectControl
        label="Focus"
        icon={<AlertTriangle size={15} />}
        value={filters.focus}
        onChange={(value) => patchFilters({ focus: value as TimelineFilters['focus'] })}
        className={stretch ? 'w-full max-w-full' : ''}
      >
        <option value="">All focus</option>
        <option value="blocked">Blocked</option>
        <option value="overdue">Overdue</option>
        <option value="due-week">Due this week</option>
        <option value="past-milestone">Past milestone</option>
      </SelectControl>

      <button
        type="button"
        onClick={() => patchFilters({ hideWeekends: !filters.hideWeekends })}
        className={[
          'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-bold transition-colors',
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
          'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-bold transition-colors',
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
          <div className="relative min-w-0 flex-1 xl:max-w-md">
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

          <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
            <button
              type="button"
              onClick={onToday}
              className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover"
            >
              <CalendarDays size={15} />
              Today
            </button>

            <div className="flex min-w-0 shrink-0 items-center rounded-lg border border-cu-border bg-cu-bg-secondary p-1">
              <Tooltip content="Previous range">
                <button
                  type="button"
                  onClick={onPreviousRange}
                  aria-label="Previous timeline range"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-cu-text-secondary transition-colors hover:bg-cu-bg hover:text-cu-primary"
                >
                  <ChevronLeft size={17} />
                </button>
              </Tooltip>
              <div className="min-w-[8.5rem] max-w-[15rem] truncate px-2 text-center text-sm font-bold text-cu-text-primary sm:min-w-[12rem]">
                {currentLabel}
              </div>
              <Tooltip content="Next range">
                <button
                  type="button"
                  onClick={onNextRange}
                  aria-label="Next timeline range"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-cu-text-secondary transition-colors hover:bg-cu-bg hover:text-cu-primary"
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

            <div className="hidden shrink-0 rounded-lg border border-cu-border bg-cu-bg-secondary p-1 sm:inline-flex">
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
              className="relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-cu-border bg-cu-bg-secondary px-3 text-sm font-bold text-cu-text-primary transition-colors hover:bg-cu-hover sm:hidden"
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

        <div className="mt-3 hidden overflow-x-auto rounded-lg border border-cu-border-light bg-cu-bg-secondary/60 p-2 custom-scrollbar sm:block">
          <div className="flex flex-wrap items-center gap-2">
            {renderFilterFields()}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-lg border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
              >
                Clear
              </button>
            )}
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
            {renderFilterFields({ stretch: true })}
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
