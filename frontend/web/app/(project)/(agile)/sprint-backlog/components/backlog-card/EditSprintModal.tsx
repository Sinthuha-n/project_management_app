'use client';

import { useState } from 'react';
import { Pencil, X, AlertCircle } from 'lucide-react';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface EditSprintModalProps {
  open: boolean;
  sprintName: string;
  loading: boolean;
  error?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function EditSprintModal({ open, sprintName, loading, error, onConfirm, onCancel }: EditSprintModalProps) {
  const [name, setName] = useState(sprintName);
  const [prevName, setPrevName] = useState(sprintName);

  if (sprintName !== prevName) {
    setName(sprintName);
    setPrevName(sprintName);
  }

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
      className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-cu-border bg-cu-bg shadow-2xl"
        style={{ animation: 'confirmSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {error && (
          <div className="absolute left-1/2 top-4 z-10 w-[calc(100%-32px)] -translate-x-1/2 rounded-[24px] border border-cu-danger/30 bg-cu-danger-light px-4 py-4 shadow-[0_24px_60px_rgba(244,63,94,0.12)] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="mt-0.5 text-cu-danger" />
              <div>
                <p className="text-sm font-semibold text-cu-danger">Sprint name already exists</p>
                <p className="mt-1 text-sm leading-6 text-cu-text-secondary">{error}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-cu-text-tertiary hover:text-cu-text-primary hover:bg-cu-hover transition-all duration-150"
        >
          <X size={16} />
        </button>

        <div className={`p-6 ${error ? 'pt-24' : ''}`}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-cu-border bg-cu-primary-light text-cu-primary">
            <Pencil size={20} />
          </div>
          <h3 className="text-[16px] font-bold text-cu-text-primary mb-1">Edit Sprint</h3>
          <p className="text-[13px] text-cu-text-secondary mb-4">Update the sprint name.</p>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }}
            autoFocus
            className={`w-full rounded-lg border bg-cu-bg text-cu-text-primary ${error ? 'border-cu-danger/60 focus:border-cu-danger focus:ring-cu-danger/20' : 'border-cu-border focus:border-cu-primary focus:ring-cu-primary/20'} px-3 py-2.5 text-[14px] outline-none focus:ring-2 transition-all duration-150`}
            placeholder="Sprint name..."
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-cu-border-light px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-cu-border bg-cu-bg px-4 py-2.5 text-[13.5px] font-semibold text-cu-text-primary hover:bg-cu-hover transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
            disabled={loading || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-cu-primary hover:bg-cu-primary-hover px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            Save Changes
          </button>
        </div>

        <style>{`
          @keyframes confirmSlideIn {
            from { opacity: 0; transform: scale(0.92) translateY(10px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
        `}</style>
      </div>
      </div>
    </OverlayPortal>
  );
}
