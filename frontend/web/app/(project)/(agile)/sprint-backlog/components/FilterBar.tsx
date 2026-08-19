'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

export interface BacklogFilters {
  search: string;
  statuses: string[];
  priorities: string[];
  assignee: string;
  assignees?: string[];
}

interface FilterBarProps {
  filters: BacklogFilters;
  onChange: (filters: BacklogFilters) => void;
  assigneeNames: string[];
}

const STATUS_OPTIONS = [
  { value: 'TODO',        label: 'To Do',       dot: 'bg-cu-text-muted' },
  { value: 'IN_PROGRESS', label: 'In Progress',  dot: 'bg-cu-primary' },
  { value: 'IN_REVIEW',   label: 'In Review',    dot: 'bg-amber-500' },
  { value: 'DONE',        label: 'Done',         dot: 'bg-cu-success' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW',      label: 'Low',      color: 'text-cu-success' },
  { value: 'MEDIUM',   label: 'Medium',   color: 'text-amber-500' },
  { value: 'HIGH',     label: 'High',     color: 'text-cu-danger' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-cu-danger' },
];

export default function FilterBar({ filters, onChange, assigneeNames }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAssignees = filters.assignees?.length
    ? filters.assignees
    : filters.assignee
    ? [filters.assignee]
    : [];

  const activeFilterCount =
    filters.statuses.length + filters.priorities.length + (selectedAssignees.length > 0 ? selectedAssignees.length : 0);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const toggleStatus = (status: string) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: next });
  };

  const togglePriority = (priority: string) => {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: next });
  };

  const toggleAssignee = (name: string) => {
    const next = selectedAssignees.includes(name)
      ? selectedAssignees.filter((a) => a !== name)
      : [...selectedAssignees, name];
    onChange({
      ...filters,
      assignees: next,
      assignee: next.length === 1 ? next[0] : '',
    });
  };

  const clearAssignees = () => {
    onChange({
      ...filters,
      assignees: [],
      assignee: '',
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted" />
          <input
            type="text"
            placeholder="Search backlog..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full rounded-xl border border-cu-border bg-cu-bg py-2 pl-8 pr-8 text-[13px] text-cu-text-primary placeholder:text-cu-text-muted focus:border-cu-primary focus:outline-none"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cu-text-muted hover:text-cu-text-primary"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition-all ${
            showFilters || activeFilterCount > 0
              ? 'border-cu-primary bg-cu-primary-light text-cu-primary'
              : 'border-cu-border bg-cu-bg text-cu-text-primary hover:bg-cu-hover'
          }`}
        >
          <Filter size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-cu-primary px-1.5 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() =>
              onChange({ search: filters.search, statuses: [], priorities: [], assignee: '', assignees: [] })
            }
            className="flex min-h-[42px] items-center text-[12px] font-semibold text-cu-text-muted hover:text-cu-danger"
          >
            Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div ref={dropdownRef} className="flex flex-wrap gap-2 rounded-xl border border-cu-border bg-cu-bg p-3">
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              className="flex min-h-[42px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cu-border bg-cu-bg text-[12px] font-bold text-cu-text-primary hover:bg-cu-hover transition-all"
            >
              Status
              {filters.statuses.length > 0 && (
                <span className="rounded-full bg-cu-primary px-1.5 text-[10px] text-white">
                  {filters.statuses.length}
                </span>
              )}
              <ChevronDown size={12} />
            </button>
            {openDropdown === 'status' && (
              <div className="absolute left-0 top-9 z-50 min-w-[150px] rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStatus(opt.value)}
                    className="flex min-h-[42px] w-full items-center gap-2 px-3 py-2 text-[12px] font-bold hover:bg-cu-hover"
                  >
                    <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
                    <span className="flex-1 text-left text-cu-text-primary">{opt.label}</span>
                    {filters.statuses.includes(opt.value) && (
                      <span className="text-cu-primary text-[14px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
              className="flex min-h-[42px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cu-border bg-cu-bg text-[12px] font-bold text-cu-text-primary hover:bg-cu-hover transition-all"
            >
              Priority
              {filters.priorities.length > 0 && (
                <span className="rounded-full bg-cu-primary px-1.5 text-[10px] text-white">
                  {filters.priorities.length}
                </span>
              )}
              <ChevronDown size={12} />
            </button>
            {openDropdown === 'priority' && (
              <div className="absolute left-0 top-9 z-50 min-w-[150px] rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => togglePriority(opt.value)}
                    className={`flex min-h-[42px] w-full items-center gap-2 px-3 py-2 text-[12px] font-bold hover:bg-cu-hover ${opt.color}`}
                  >
                    <span className="flex-1 text-left">{opt.label}</span>
                    {filters.priorities.includes(opt.value) && (
                      <span className="text-cu-primary text-[14px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
              className="flex min-h-[42px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cu-border bg-cu-bg text-[12px] font-bold text-cu-text-primary hover:bg-cu-hover transition-all"
            >
              Assignees
              {selectedAssignees.length > 0 && (
                <span className="rounded-full bg-cu-primary px-1.5 text-[10px] text-white">
                  {selectedAssignees.length}
                </span>
              )}
              <ChevronDown size={12} />
            </button>
            {openDropdown === 'assignee' && (
              <div className="absolute left-0 top-9 z-50 min-w-[180px] max-h-56 overflow-y-auto rounded-xl border border-cu-border bg-cu-bg p-1 shadow-cu-xl">
                <button
                  onClick={() => {
                    clearAssignees();
                    setOpenDropdown(null);
                  }}
                  className={`flex min-h-[38px] w-full items-center justify-between px-3 py-1.5 text-[12px] font-bold rounded-lg hover:bg-cu-hover ${
                    selectedAssignees.length === 0 ? 'text-cu-primary bg-cu-primary-light' : 'text-cu-text-primary'
                  }`}
                >
                  <span>All</span>
                  {selectedAssignees.length === 0 && <span className="text-cu-primary text-[14px]">✓</span>}
                </button>
                <div className="my-1 border-t border-cu-border" />
                {assigneeNames.map((name) => {
                  const isSelected = selectedAssignees.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleAssignee(name)}
                      className={`flex min-h-[38px] w-full items-center justify-between px-3 py-1.5 text-[12px] font-bold rounded-lg hover:bg-cu-hover ${
                        isSelected ? 'text-cu-primary bg-cu-primary-light' : 'text-cu-text-primary'
                      }`}
                    >
                      <span className="truncate">{name}</span>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
