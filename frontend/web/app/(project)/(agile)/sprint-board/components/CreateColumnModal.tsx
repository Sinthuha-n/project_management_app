'use client';

import React, { useState } from 'react';
import { X, Layout, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface CreateColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateColumn: (name: string, status: string) => Promise<void>;
  loading?: boolean;
}

export default function CreateColumnModal({
  isOpen,
  onClose,
  onCreateColumn,
  loading = false,
}: CreateColumnModalProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('TODO');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateColumn(name.trim(), status);
    setName('');
    setStatus('TODO');
    onClose();
  };

  const statusOptions = [
    { value: 'TODO', label: 'To Do', color: 'bg-blue-500' },
    { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
    { value: 'IN_REVIEW', label: 'In Review', color: 'bg-sky-500' },
    { value: 'DONE', label: 'Done', color: 'bg-emerald-500' },
  ];

  return (
    <OverlayPortal>
      <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-cu-border bg-cu-bg shadow-cu-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cu-border bg-cu-bg-secondary px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cu-primary/10 flex items-center justify-center text-cu-primary">
                  <Layout size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-cu-text-primary">Create New Column</h3>
                  <p className="text-xs text-cu-text-secondary">Organize your sprint workflow</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-cu-text-muted transition-all hover:bg-cu-hover hover:text-cu-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-cu-text-primary">Column Name</label>
                <input
                  type="text"
                  placeholder="e.g. QA Testing, Ready for Review"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-cu-border bg-cu-bg-secondary px-4 py-3 text-sm text-cu-text-primary transition-all placeholder:text-cu-text-muted focus:border-cu-primary focus:outline-none focus:ring-4 focus:ring-cu-primary/10"
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-bold text-cu-text-primary">
                  Map to Status
                  <div className="group relative">
                    <Info size={14} className="cursor-help text-cu-text-muted" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-lg border border-cu-border bg-cu-bg-secondary p-2 text-[10px] text-cu-text-secondary opacity-0 shadow-cu-lg transition-opacity group-hover:opacity-100">
                      This determines the business logic and task progression of the column.
                    </div>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`
                        flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left
                        ${status === opt.value 
                          ? 'border-cu-primary bg-cu-primary/5 shadow-sm ring-4 ring-cu-primary/5' 
                          : 'border-cu-border bg-cu-bg-secondary hover:border-cu-primary/30 hover:bg-cu-hover'}
                      `}
                    >
                      <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                      <span className={`text-[13px] font-bold ${status === opt.value ? 'text-cu-primary' : 'text-cu-text-primary'}`}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-cu-border bg-cu-bg-secondary px-4 py-3 text-sm font-bold text-cu-text-secondary transition-all hover:bg-cu-hover hover:text-cu-text-primary active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="flex-1 rounded-xl bg-cu-primary px-4 py-3 text-sm font-bold text-white shadow-cu-lg shadow-cu-primary/20 transition-all hover:bg-cu-primary-hover active:scale-95 disabled:opacity-50 disabled:shadow-none"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Column'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
