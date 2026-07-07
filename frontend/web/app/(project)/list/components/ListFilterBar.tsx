'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter, Layers, Search, X } from 'lucide-react';
import { PRIORITY_CONFIG } from '../lib/list-config';

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
  groupBy: 'none' | 'status' | 'priority' | 'assignee';
  onGroupByChange: (next: 'none' | 'status' | 'priority' | 'assignee') => void;
}

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITY_OPTIONS = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'TODO':
      return (
        <svg className="w-3.5 h-3.5 text-cu-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case 'IN_PROGRESS':
      return (
        <svg className="w-3.5 h-3.5 text-cu-primary flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeDasharray="30 30" strokeLinecap="round" />
        </svg>
      );
    case 'IN_REVIEW':
      return (
        <svg className="w-3.5 h-3.5 text-warning flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeDasharray="6 6" />
        </svg>
      );
    case 'DONE':
      return (
        <svg className="w-3.5 h-3.5 text-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" fillOpacity="0.2">
          <circle cx="12" cy="12" r="10" fill="currentColor" />
          <path d="M7.5 12.5l3 3 6-6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5 text-cu-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

export default function ListFilterBar({
  filters,
  onChange,
  assigneeNames,
  groupBy,
  onGroupByChange,
}: ListFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeCount =
    filters.statuses.length + filters.priorities.length + (filters.assignee ? 1 : 0);

  const btnBase = 'h-9 px-3 rounded-xl border border-cu-border/60 text-[11px] font-semibold text-cu-text-secondary bg-cu-bg hover:bg-cu-hover hover:text-cu-text-primary flex items-center gap-1.5 transition-all duration-200 active:scale-95 shadow-cu-sm cursor-pointer';
  const dropdownBase = 'absolute top-10.5 left-0 z-50 min-w-[175px] rounded-xl border border-cu-border bg-cu-bg/95 backdrop-blur-md shadow-cu-xl overflow-hidden py-1 animate-slide-up';
  const optionBase = 'w-full text-left px-3.5 py-2 text-[12px] hover:bg-cu-hover/80 transition-colors flex items-center gap-2 cursor-pointer';

  return (
    <div ref={ref} className="rounded-2xl border border-cu-border/50 bg-cu-bg/40 backdrop-blur-sm p-3 shadow-cu-sm mb-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">

        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cu-text-tertiary" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by task title or assignee..."
            className="w-full h-9 rounded-xl border border-cu-border/60 bg-cu-bg text-cu-text-primary placeholder:text-cu-text-muted pl-9 pr-8 text-[12px] focus:outline-none focus:ring-2 focus:ring-cu-primary/25 focus:border-cu-primary transition-all duration-200 shadow-cu-sm"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cu-text-tertiary hover:text-cu-text-primary cursor-pointer"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="relative">
          <button onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')} className={btnBase}>
            <Filter size={12} className="text-cu-text-tertiary" />
            <span>Status</span>
            {filters.statuses.length > 0 && (
              <span className="text-cu-primary font-bold">({filters.statuses.length})</span>
            )}
            <ChevronDown size={11} className="text-cu-text-muted" />
          </button>
          {openMenu === 'status' && (
            <div className={dropdownBase}>
              {STATUS_OPTIONS.map((status) => {
                const isSelected = filters.statuses.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => {
                      const has = filters.statuses.includes(status);
                      onChange({ ...filters, statuses: has ? filters.statuses.filter((x) => x !== status) : [...filters.statuses, status] });
                    }}
                    className={`${optionBase} ${isSelected ? 'font-bold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
                  >
                    <StatusIcon status={status} />
                    <span className="flex-1 text-left capitalize">{status.replace(/_/g, ' ').toLowerCase()}</span>
                    {isSelected && <span className="text-[10px] text-cu-primary font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority filter */}
        <div className="relative">
          <button onClick={() => setOpenMenu(openMenu === 'priority' ? null : 'priority')} className={btnBase}>
            <span>Priority</span>
            {filters.priorities.length > 0 && (
              <span className="text-cu-primary font-bold">({filters.priorities.length})</span>
            )}
            <ChevronDown size={11} className="text-cu-text-muted" />
          </button>
          {openMenu === 'priority' && (
            <div className={dropdownBase}>
              {PRIORITY_OPTIONS.map((priority) => {
                const isSelected = filters.priorities.includes(priority);
                const pc = PRIORITY_CONFIG[priority];
                const Icon = pc?.icon;
                return (
                  <button
                    key={priority}
                    onClick={() => {
                      const has = filters.priorities.includes(priority);
                      onChange({ ...filters, priorities: has ? filters.priorities.filter((x) => x !== priority) : [...filters.priorities, priority] });
                    }}
                    className={`${optionBase} ${isSelected ? 'font-bold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
                  >
                    {Icon && <Icon size={12} style={{ color: pc.color }} />}
                    <span className="flex-1 text-left capitalize" style={Icon ? { color: pc.color } : undefined}>
                      {priority.toLowerCase()}
                    </span>
                    {isSelected && <span className="text-[10px] text-cu-primary font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignee filter */}
        <div className="relative">
          <button onClick={() => setOpenMenu(openMenu === 'assignee' ? null : 'assignee')} className={btnBase}>
            <span>Assignee</span>
            {filters.assignee && <span className="text-cu-primary font-bold">(1)</span>}
            <ChevronDown size={11} className="text-cu-text-muted" />
          </button>
          {openMenu === 'assignee' && (
            <div className={`${dropdownBase} max-h-52 overflow-y-auto`}>
              <button
                onClick={() => onChange({ ...filters, assignee: '' })}
                className={`${optionBase} ${!filters.assignee ? 'font-bold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
              >
                <span className="flex-1 text-left">All assignees</span>
                {!filters.assignee && <span className="text-[10px] text-cu-primary font-bold">✓</span>}
              </button>
              {assigneeNames.map((name) => {
                const isSelected = filters.assignee === name;
                return (
                  <button
                    key={name}
                    onClick={() => onChange({ ...filters, assignee: name })}
                    className={`${optionBase} ${isSelected ? 'font-bold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
                  >
                    <span className="flex-1 text-left">{name}</span>
                    {isSelected && <span className="text-[10px] text-cu-primary font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Group by */}
        <button
          onClick={() => onGroupByChange(groupBy === 'none' ? 'status' : groupBy === 'status' ? 'priority' : groupBy === 'priority' ? 'assignee' : 'none')}
          className={btnBase}
        >
          <Layers size={12} className="text-cu-text-tertiary" />
          <span className="capitalize">{groupBy === 'none' ? 'Group by' : `By ${groupBy}`}</span>
        </button>

        {/* Clear */}
        {activeCount > 0 && (
          <button
            onClick={() => onChange({ ...filters, statuses: [], priorities: [], assignee: '' })}
            className="h-9 px-3 rounded-xl border border-cu-border/60 text-[11px] font-bold text-cu-text-secondary hover:text-cu-text-primary bg-cu-bg hover:bg-cu-hover hover:border-cu-border transition-all duration-200 shadow-cu-sm active:scale-95 cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}

