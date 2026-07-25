'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Rocket,
  Trash2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SprintHeaderProps {
  sprintName: string;
  sprintStatus: string;
  sprintEndDate?: string;
  isOpen: boolean;
  totals: { todo: number; inprogress: number; done: number };
  canDeleteSprint: boolean;
  onToggleOpen: () => void;
  onEditSprint: () => void;
  onStartSprint: () => void;
  onCompleteSprint: () => void;
  onDeleteSprint: () => void;
  onViewReport: () => void;
  onNameSave: (name: string) => Promise<void>;
  existingSprintNames?: string[];
  editingSprintLoading: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SprintHeader({
  sprintName,
  sprintStatus,
  sprintEndDate,
  isOpen,
  totals,
  canDeleteSprint,
  onToggleOpen,
  onEditSprint,
  onStartSprint,
  onCompleteSprint,
  onDeleteSprint,
  onViewReport,
  onNameSave,
  existingSprintNames = [],
  editingSprintLoading,
}: SprintHeaderProps) {
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempSprintName, setTempSprintName] = useState(sprintName);
  const [nameError, setNameError] = useState('');
  const sprintMenuRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    queueMicrotask(() => setTempSprintName(sprintName));
  }, [sprintName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.setSelectionRange(tempSprintName.length, tempSprintName.length);
    }
  }, [isEditingName, tempSprintName.length]);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (sprintMenuRef.current && !sprintMenuRef.current.contains(event.target as Node)) {
        setShowSprintMenu(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSprintMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNameDoubleClick = () => {
    setNameError('');
    setIsEditingName(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      handleNameDoubleClick();
    }
    lastTapRef.current = now;
    longPressTimerRef.current = setTimeout(() => {
      if (canDeleteSprint) onDeleteSprint();
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };
  const handleTouchMove = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const handleNameSaveInternal = async () => {
    const trimmed = tempSprintName.trim();
    if (!trimmed || trimmed === sprintName) {
      setNameError('');
      setIsEditingName(false);
      return;
    }

    const normalizedExistingNames = existingSprintNames
      .filter((name) => name !== sprintName)
      .map((name) => name.toLowerCase());

    if (normalizedExistingNames.includes(trimmed.toLowerCase())) {
      setNameError('Sprint name already exists. Please choose a unique name.');
      return;
    }

    setNameError('');
    await onNameSave(trimmed);
    setIsEditingName(false);
  };

  // Days left badge
  const daysLeftBadge = (() => {
    if (!sprintEndDate || sprintStatus === 'COMPLETED') return null;
    const daysLeft = Math.ceil(
      (new Date(sprintEndDate + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft < 0) return null;
    const isDanger = daysLeft <= 2;
    const isWarning = !isDanger && daysLeft <= 7;
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-bold ${
        isDanger ? 'border-cu-danger/30 bg-cu-danger-light text-cu-danger' :
        isWarning ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' :
        'border-cu-border bg-cu-bg-secondary text-cu-text-secondary'
      }`}>
        {daysLeft}d left
      </span>
    );
  })();

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-cu-border pb-4 gap-3 sm:gap-4">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded border border-cu-text-tertiary bg-transparent" />

        <button
          type="button"
          onClick={onToggleOpen}
          className="text-cu-text-primary p-1 hover:bg-cu-hover rounded-lg transition-colors duration-150"
        >
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {isEditingName ? (
            <div className="flex flex-col gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={tempSprintName}
                onChange={(e) => {
                  setTempSprintName(e.target.value);
                  if (nameError) setNameError('');
                }}
                onBlur={() => void handleNameSaveInternal()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleNameSaveInternal();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                disabled={editingSprintLoading}
                className="w-full min-w-[200px] border-b border-cu-primary bg-transparent text-[14px] font-bold text-cu-text-primary outline-none"
              />
              {nameError ? (
                <div className="rounded-xl border border-cu-danger/30 bg-cu-danger-light px-3 py-2 text-[13px] text-cu-danger">
                  {nameError}
                </div>
              ) : null}
            </div>
          ) : (
            <span
              onClick={(e) => {
                const now = Date.now();
                if (now - lastTapRef.current < 300) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNameDoubleClick();
                }
                lastTapRef.current = now;
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleNameDoubleClick();
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              className="cursor-text text-[14px] font-bold text-cu-text-primary select-none"
            >
              {sprintName}
            </span>
          )}

          <button
            onClick={() => setIsEditingName(!isEditingName)}
            className="p-1.5 text-cu-text-tertiary hover:text-cu-primary hover:bg-cu-hover rounded-lg transition-colors"
            title="Edit Sprint Name"
          >
            <Pencil size={14} />
          </button>

          {daysLeftBadge}
        </div>
      </div>

      <div className="relative flex items-center justify-end gap-3 flex-1" ref={sprintMenuRef}>
        <div className="flex items-center gap-1.5 bg-cu-bg border border-cu-border px-2 py-1 rounded-full shadow-cu-sm">
          <div className="rounded-full bg-cu-bg-tertiary px-2 py-[2px] text-[12px] font-bold text-cu-text-primary" title="To Do">
            {totals.todo}
          </div>
          <div className="rounded-full bg-cu-primary-light px-2 py-[2px] text-[12px] font-bold text-cu-primary" title="In Progress">
            {totals.inprogress}
          </div>
          <div className="rounded-full bg-cu-success-light px-2 py-[2px] text-[12px] font-bold text-cu-success" title="Done">
            {totals.done}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sprintStatus === 'NOT_STARTED' ? (
            <button
              onClick={onStartSprint}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-cu-primary bg-cu-primary px-3.5 py-2 text-[12px] font-bold text-white hover:bg-cu-primary-hover shadow-sm transform active:scale-95 transition-all duration-150"
            >
              <Rocket size={14} />
              <span>Start Sprint</span>
            </button>
          ) : sprintStatus === 'ACTIVE' ? (
            <button
              onClick={onCompleteSprint}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-emerald-700 shadow-sm transform active:scale-95 transition-all duration-150"
            >
              <Check size={14} />
              <span>Complete Sprint</span>
            </button>
          ) : null}

          <button
            onClick={onViewReport}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-cu-border bg-cu-bg px-3 py-2 text-[12px] font-bold text-cu-text-primary hover:bg-cu-hover transition-all"
          >
            <BarChart3 size={14} />
            <span className="hidden sm:inline">Sprint Report</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSprintMenu((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={showSprintMenu}
            aria-label="Sprint actions"
            className="p-2 text-cu-text-primary hover:bg-cu-hover rounded-lg transition-colors duration-150"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {showSprintMenu && (
          <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => { setShowSprintMenu(false); onEditSprint(); }}
              className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-cu-text-primary hover:bg-cu-hover"
            >
              <Pencil size={18} className="text-cu-text-secondary" />
              <span>Edit Sprint</span>
            </button>

            {sprintStatus === 'NOT_STARTED' && (
              <button
                onClick={() => { setShowSprintMenu(false); onStartSprint(); }}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-cu-text-primary hover:bg-cu-hover"
              >
                <Rocket size={18} className="text-cu-primary" />
                <span>Start Sprint</span>
              </button>
            )}

            {sprintStatus === 'ACTIVE' && (
              <button
                onClick={() => { setShowSprintMenu(false); onCompleteSprint(); }}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-cu-success hover:bg-cu-hover"
              >
                <Check size={18} />
                <span>Complete Sprint</span>
              </button>
            )}

            <button
              onClick={() => { onViewReport(); setShowSprintMenu(false); }}
              className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-cu-text-primary hover:bg-cu-hover"
            >
              <BarChart3 size={18} className="text-cu-text-secondary" />
              <span>View Report</span>
            </button>

            <div className="border-t border-cu-border" />

            <button
              onClick={() => { setShowSprintMenu(false); onDeleteSprint(); }}
              disabled={!canDeleteSprint}
              className={`flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold ${
                canDeleteSprint ? 'text-cu-danger hover:bg-cu-danger-light' : 'text-cu-text-muted cursor-not-allowed'
              }`}
              title={!canDeleteSprint ? "Only an Admin or Owner can delete a sprint" : ""}
            >
              <Trash2 size={18} />
              <div className="flex flex-col">
                <span>Delete Sprint</span>
                {!canDeleteSprint && (
                  <span className="text-[10px] font-medium text-cu-text-muted">
                    Admin/Owner only
                  </span>
                )}
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
