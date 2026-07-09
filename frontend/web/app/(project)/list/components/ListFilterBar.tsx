'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown, Filter, Layers, Search, SlidersHorizontal, X } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  GROUP_OPTIONS,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  STATUS_ORDER,
  formatPriorityLabel,
  formatStatusLabel,
  type ListGroupBy,
} from '../lib/list-config';

export interface ListFilters {
  search: string;
  statuses: string[];
  priorities: string[];
  assignee: string;
}

interface ListFilterBarProps {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
  assigneeNames: string[];
  groupBy: ListGroupBy;
  onGroupByChange: (next: ListGroupBy) => void;
}

const chipClass =
  'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg px-2.5 text-[12px] font-semibold text-cu-text-secondary';

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function SelectableItem({
  selected,
  children,
  onSelect,
}: {
  selected: boolean;
  children: ReactNode;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className="min-h-9 justify-between text-[12px] font-semibold"
    >
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      {selected && <Check size={13} className="text-cu-primary" />}
    </DropdownMenuItem>
  );
}

function FilterDropdown({
  label,
  count,
  children,
  icon,
}: {
  label: string;
  count?: number;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-[12px] font-semibold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary md:w-auto">
        {icon}
        <span className="min-w-0 truncate">{label}</span>
        {count ? (
          <span className="rounded-full bg-cu-primary px-1.5 text-[10px] font-bold text-white">{count}</span>
        ) : null}
        <ChevronDown size={13} className="text-cu-text-tertiary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[190px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ListFilterBar({
  filters,
  onChange,
  assigneeNames,
  groupBy,
  onGroupByChange,
}: ListFilterBarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFilterCount = filters.statuses.length + filters.priorities.length + (filters.assignee ? 1 : 0);
  const groupLabel = GROUP_OPTIONS.find((option) => option.value === groupBy)?.label ?? 'None';
  const hasSearch = filters.search.trim().length > 0;

  const clearAll = () => {
    onChange({ search: '', statuses: [], priorities: [], assignee: '' });
    onGroupByChange('none');
    setMobileFiltersOpen(false);
  };

  const filterControls = (
    <>
      <FilterDropdown
        label="Status"
        count={filters.statuses.length}
        icon={<Filter size={13} className="text-cu-text-tertiary" />}
      >
        {STATUS_ORDER.map((status) => (
          <SelectableItem
            key={status}
            selected={filters.statuses.includes(status)}
            onSelect={() => onChange({ ...filters, statuses: toggleValue(filters.statuses, status) })}
          >
            <span className="h-2 w-2 rounded-full bg-cu-text-muted" />
            {formatStatusLabel(status)}
          </SelectableItem>
        ))}
      </FilterDropdown>

      <FilterDropdown label="Priority" count={filters.priorities.length}>
        {PRIORITY_ORDER.map((priority) => {
          const config = PRIORITY_CONFIG[priority];
          const Icon = config.icon;
          return (
            <SelectableItem
              key={priority}
              selected={filters.priorities.includes(priority)}
              onSelect={() => onChange({ ...filters, priorities: toggleValue(filters.priorities, priority) })}
            >
              <Icon size={13} style={{ color: config.color }} />
              <span style={{ color: config.color }}>{config.label}</span>
            </SelectableItem>
          );
        })}
      </FilterDropdown>

      <FilterDropdown label="Assignee" count={filters.assignee ? 1 : 0}>
        <SelectableItem
          selected={!filters.assignee}
          onSelect={() => onChange({ ...filters, assignee: '' })}
        >
          All assignees
        </SelectableItem>
        {assigneeNames.map((name) => (
          <SelectableItem
            key={name}
            selected={filters.assignee === name}
            onSelect={() => onChange({ ...filters, assignee: name })}
          >
            <span className="truncate">{name}</span>
          </SelectableItem>
        ))}
      </FilterDropdown>

      <FilterDropdown
        label={`Group: ${groupLabel}`}
        icon={<Layers size={13} className="text-cu-text-tertiary" />}
      >
        {GROUP_OPTIONS.map((option) => (
          <SelectableItem
            key={option.value}
            selected={groupBy === option.value}
            onSelect={() => onGroupByChange(option.value)}
          >
            {option.label}
          </SelectableItem>
        ))}
      </FilterDropdown>
    </>
  );

  return (
    <div className="mb-4 rounded-cu-lg border border-cu-border bg-cu-bg p-3 shadow-cu-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-tertiary" />
            <input
              type="text"
              value={filters.search}
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder="Search tasks or assignees"
              className="h-10 w-full rounded-cu-md border border-cu-border bg-cu-bg pl-9 pr-9 text-[13px] text-cu-text-primary outline-none transition-all placeholder:text-cu-text-muted focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/20"
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: '' })}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-cu-md text-cu-text-tertiary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-cu-md border border-cu-border bg-cu-bg px-2.5 text-[12px] font-bold text-cu-text-primary shadow-cu-sm min-[360px]:gap-2 min-[360px]:px-3 md:hidden"
          >
            <SlidersHorizontal size={15} />
            <span className="hidden min-[360px]:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cu-primary px-1.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {filterControls}
            {(activeFilterCount > 0 || groupBy !== 'none' || hasSearch) && (
              <button
                type="button"
                onClick={clearAll}
                className="h-9 rounded-cu-md px-3 text-[12px] font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {(activeFilterCount > 0 || groupBy !== 'none') && (
          <div className="flex flex-wrap gap-2">
            {filters.statuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onChange({ ...filters, statuses: filters.statuses.filter((item) => item !== status) })}
                className={chipClass}
              >
                <span className="min-w-0 truncate">{formatStatusLabel(status)}</span>
                <X size={12} />
              </button>
            ))}
            {filters.priorities.map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() => onChange({ ...filters, priorities: filters.priorities.filter((item) => item !== priority) })}
                className={chipClass}
              >
                <span className="min-w-0 truncate">{formatPriorityLabel(priority)}</span>
                <X size={12} />
              </button>
            ))}
            {filters.assignee && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, assignee: '' })}
                className={chipClass}
              >
                <span className="min-w-0 truncate">{filters.assignee}</span>
                <X size={12} />
              </button>
            )}
            {groupBy !== 'none' && (
              <button
                type="button"
                onClick={() => onGroupByChange('none')}
                className={chipClass}
              >
                <span className="min-w-0 truncate">Grouped by {groupLabel}</span>
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <BottomSheet
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filters"
        snapPoint="auto"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">{filterControls}</div>
          {(activeFilterCount > 0 || groupBy !== 'none' || hasSearch) && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-2 h-11 rounded-cu-md border border-cu-border bg-cu-bg text-[13px] font-bold text-cu-text-primary"
            >
              Clear all
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
