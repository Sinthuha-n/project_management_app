'use client';

import { AlertTriangle, CheckCircle2, Archive, ArrowRight } from 'lucide-react';
import OverlayPortal from '@/components/ui/OverlayPortal';

export interface AvailableDestSprint {
  id: number;
  name: string;
}

interface CompleteSprintModalProps {
  open: boolean;
  sprintName: string;
  incompleteCount: number;
  availableSprints: AvailableDestSprint[];
  destination: number | null;
  onSelectDestination: (sprintId: number | null) => void;
  onComplete: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CompleteSprintModal({
  open,
  sprintName,
  incompleteCount,
  availableSprints,
  destination,
  onSelectDestination,
  onComplete,
  onCancel,
  isLoading,
}: CompleteSprintModalProps) {
  if (!open) return null;

  const hasIncomplete = incompleteCount > 0;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#EAECF0] p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-[#101828] mb-1">Complete Sprint</h3>
        <p className="text-sm text-[#667085] mb-4">
          Mark <strong className="text-[#101828]">{sprintName}</strong> as completed
        </p>

        {hasIncomplete ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700 font-medium">
                {incompleteCount} task{incompleteCount !== 1 ? 's are' : ' is'} not done
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-[#344054] mb-2">Move incomplete tasks to:</p>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    destination === null ? 'border-[#155DFC] bg-blue-50' : 'border-[#EAECF0] hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="backlog-dest"
                    checked={destination === null}
                    onChange={() => onSelectDestination(null)}
                    className="accent-[#155DFC]"
                  />
                  <Archive size={15} className="text-[#667085] flex-shrink-0" />
                  <span className="text-sm font-medium text-[#101828]">Backlog</span>
                </label>

                {availableSprints.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      destination === s.id ? 'border-[#155DFC] bg-blue-50' : 'border-[#EAECF0] hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="backlog-dest"
                      checked={destination === s.id}
                      onChange={() => onSelectDestination(s.id)}
                      className="accent-[#155DFC]"
                    />
                    <ArrowRight size={15} className="text-[#667085] flex-shrink-0" />
                    <span className="text-sm font-medium text-[#101828]">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3">
            <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
            <span className="text-sm text-green-700 font-medium">All tasks are done!</span>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#D0D5DD] px-3 py-2.5 text-sm font-semibold text-[#344054] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onComplete}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-[#D92D20] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#B42318] transition-colors"
          >
            {isLoading ? 'Completing...' : 'Complete Sprint'}
          </button>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}
