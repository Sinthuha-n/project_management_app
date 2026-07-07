'use client';

import { AlertTriangle, CheckCircle2, Archive, ArrowRight } from 'lucide-react';

export interface AvailableDestSprint {
  id: number;
  name: string;
}

interface CompleteSprintModalProps {
  open: boolean;
  allActiveSprints: Array<{ id: number; sprintName?: string }>;
  sprintIdToComplete: number | null;
  onSelectSprint: (id: number) => void;
  incompleteCount: number;
  availableDestSprints: AvailableDestSprint[];
  destination: number | null;
  onSelectDestination: (sprintId: number | null) => void;
  onComplete: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CompleteSprintModal({
  open,
  allActiveSprints,
  sprintIdToComplete,
  onSelectSprint,
  incompleteCount,
  availableDestSprints,
  destination,
  onSelectDestination,
  onComplete,
  onCancel,
  isLoading,
}: CompleteSprintModalProps) {
  if (!open) return null;

  const hasIncomplete = incompleteCount > 0;

  return (
    <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cu-border bg-cu-bg p-6 shadow-cu-xl">
        <h3 className="mb-1 text-lg font-bold text-cu-text-primary">Complete Sprint</h3>
        <p className="mb-4 text-sm text-cu-text-secondary">Select the sprint to complete</p>

        {/* Sprint selector — only shown when multiple active sprints */}
        {allActiveSprints.length > 1 && (
          <div className="space-y-2 mb-4">
            {allActiveSprints.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSprint(s.id)}
                className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-colors ${
                  sprintIdToComplete === s.id
                    ? 'border-cu-primary bg-cu-primary/10 text-cu-primary'
                    : 'border-cu-border bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover'
                }`}
              >
                {s.sprintName || `Sprint #${s.id}`}
              </button>
            ))}
          </div>
        )}

        {/* Incomplete task warning */}
        {hasIncomplete ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700 font-medium">
                {incompleteCount} task{incompleteCount !== 1 ? 's are' : ' is'} not done
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-cu-text-primary mb-2">Move incomplete tasks to:</p>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    destination === null ? 'border-cu-primary bg-cu-primary/10' : 'border-cu-border hover:bg-cu-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="dest"
                    checked={destination === null}
                    onChange={() => onSelectDestination(null)}
                    className="accent-cu-primary"
                  />
                  <Archive size={15} className="text-cu-text-secondary flex-shrink-0" />
                  <span className="text-sm font-medium text-cu-text-primary">Backlog</span>
                </label>

                {availableDestSprints.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      destination === s.id ? 'border-cu-primary bg-cu-primary/10' : 'border-cu-border hover:bg-cu-hover'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dest"
                      checked={destination === s.id}
                      onChange={() => onSelectDestination(s.id)}
                      className="accent-cu-primary"
                    />
                    <ArrowRight size={15} className="text-cu-text-secondary flex-shrink-0" />
                    <span className="text-sm font-medium text-cu-text-primary">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            <span className="text-sm text-emerald-500 font-medium">All tasks are done!</span>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-cu-border px-3 py-2.5 text-sm font-semibold text-cu-text-secondary hover:bg-cu-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onComplete}
            disabled={isLoading || !sprintIdToComplete}
            className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-700 transition-colors"
          >
            {isLoading ? 'Completing...' : 'Complete Sprint'}
          </button>
        </div>
      </div>
    </div>
  );
}
