'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronDown, Filter } from 'lucide-react';
import { Label } from '../types';
import { TeamMemberOption } from '../api';
import { PRIORITY_OPTIONS } from '../constants';

interface KanbanFilterBarProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterPriority: string[];
  setFilterPriority: React.Dispatch<React.SetStateAction<string[]>>;
  filterAssignee: string;
  setFilterAssignee: (v: string) => void;
  filterLabel: number | null;
  setFilterLabel: (v: number | null) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  teamMembers: TeamMemberOption[];
  labels: Label[];
}

const PRIORITY_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  LOW:    { active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', inactive: 'bg-cu-bg text-cu-text-secondary border-cu-border hover:border-emerald-500/40' },
  MEDIUM: { active: 'bg-amber-400/15 text-amber-500 border-amber-400/30', inactive: 'bg-cu-bg text-cu-text-secondary border-cu-border hover:border-amber-400/40' },
  HIGH:   { active: 'bg-orange-500/15 text-orange-500 border-orange-500/30', inactive: 'bg-cu-bg text-cu-text-secondary border-cu-border hover:border-orange-500/40' },
  URGENT: { active: 'bg-red-500/15 text-red-500 border-red-500/30', inactive: 'bg-cu-bg text-cu-text-secondary border-cu-border hover:border-red-500/40' },
};

export default function KanbanFilterBar({
  filterPriority,
  setFilterPriority,
  filterAssignee,
  setFilterAssignee,
  filterLabel,
  setFilterLabel,
  clearFilters,
  hasActiveFilters,
  teamMembers,
  labels,
}: KanbanFilterBarProps) {
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);
  const [labelFilterOpen, setLabelFilterOpen] = useState(false);
  const assigneeFilterRef = useRef<HTMLDivElement>(null);
  const labelFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (assigneeFilterRef.current && !assigneeFilterRef.current.contains(e.target as Node)) setAssigneeFilterOpen(false);
      if (labelFilterRef.current && !labelFilterRef.current.contains(e.target as Node)) setLabelFilterOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeFilterCount = filterPriority.length + (filterAssignee ? 1 : 0) + (filterLabel ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
      {/* Filter icon label */}
      <div className="flex items-center gap-1 text-xs text-cu-text-muted mr-1">
        <Filter size={12} />
        <span className="hidden sm:inline font-medium">Filters</span>
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold">
            {activeFilterCount}
          </span>
        )}
      </div>

      {/* Priority filter pills */}
      {PRIORITY_OPTIONS.map(opt => {
        const isActive = filterPriority.includes(opt.value);
        const colors = PRIORITY_PILL_COLORS[opt.value];
        return (
          <button
            key={opt.value}
            onClick={() => setFilterPriority(prev =>
              prev.includes(opt.value) ? prev.filter(p => p !== opt.value) : [...prev, opt.value]
            )}
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 ${
              isActive ? colors.active : colors.inactive
            }`}
          >
            {opt.label}
          </button>
        );
      })}

      {/* Divider */}
      {(teamMembers.length > 0 || labels.length > 0) && (
        <div className="w-px h-4 bg-cu-border mx-0.5" />
      )}

      {/* Assignee filter dropdown */}
      {teamMembers.length > 0 && (
        <div ref={assigneeFilterRef} className="relative">
          <button
            type="button"
            onClick={() => setAssigneeFilterOpen(o => !o)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              filterAssignee
                ? 'bg-cu-primary/10 text-cu-primary border-cu-primary/30'
                : 'bg-cu-bg text-cu-text-secondary border-cu-border hover:border-cu-border'
            }`}
          >
            <span className="max-w-[80px] truncate">{filterAssignee || 'Assignee'}</span>
            <ChevronDown size={11} className="text-cu-text-muted flex-shrink-0" />
          </button>
          {assigneeFilterOpen && (
            <div className="absolute top-full left-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-[var(--cu-z-modal-popover)] min-w-[220px] max-h-80 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => { setFilterAssignee(''); setAssigneeFilterOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-cu-hover transition-colors ${!filterAssignee ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
              >
                All Assignees
              </button>
              {teamMembers.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setFilterAssignee(m.name); setAssigneeFilterOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-cu-hover transition-colors flex items-center gap-2 ${filterAssignee === m.name ? 'font-semibold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {m.photoUrl ? (
                      <Image src={m.photoUrl} alt={m.name} width={20} height={20} className="w-full h-full object-cover" unoptimized />
                    ) : (
                      m.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Label filter dropdown */}
      {labels.length > 0 && (
        <div ref={labelFilterRef} className="relative">
          <button
            type="button"
            onClick={() => setLabelFilterOpen(o => !o)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              filterLabel
                ? 'bg-violet-500/10 text-violet-500 border-violet-500/30'
                : 'bg-cu-bg text-cu-text-secondary border-cu-border hover:border-cu-border'
            }`}
          >
            {filterLabel && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: labels.find(l => l.id === filterLabel)?.color ?? '#6366F1' }} />
            )}
            <span className="max-w-[80px] truncate">{filterLabel ? labels.find(l => l.id === filterLabel)?.name ?? 'Label' : 'Label'}</span>
            <ChevronDown size={11} className="text-cu-text-muted flex-shrink-0" />
          </button>
          {labelFilterOpen && (
            <div className="absolute top-full left-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-50 min-w-[180px] max-h-52 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => { setFilterLabel(null); setLabelFilterOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-cu-hover transition-colors ${!filterLabel ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
              >
                All Labels
              </button>
              {labels.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setFilterLabel(l.id); setLabelFilterOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-cu-hover transition-colors flex items-center gap-2 ${filterLabel === l.id ? 'font-semibold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color ?? '#6366F1' }} />
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-cu-text-secondary hover:text-cu-danger border border-cu-border rounded-full hover:border-cu-danger/40 transition-all ml-1"
        >
          <X size={10} />
          Clear
        </button>
      )}
    </div>
  );
}
