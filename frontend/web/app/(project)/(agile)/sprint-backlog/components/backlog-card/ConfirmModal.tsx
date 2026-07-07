'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';

export interface ConfirmModalProps {
  open: boolean;
  variant: 'danger' | 'warning' | 'success';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  variant,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const variantConfig = {
    danger: {
      iconBg: 'bg-cu-danger-light',
      iconColor: 'text-cu-danger',
      icon: <Trash2 size={22} />,
      btnClass: 'bg-cu-danger hover:bg-cu-danger/85 text-white',
      borderColor: 'border-cu-danger/30',
    },
    warning: {
      iconBg: 'bg-amber-50 dark:bg-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      icon: <AlertTriangle size={22} />,
      btnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
      borderColor: 'border-amber-300 dark:border-amber-500/30',
    },
    success: {
      iconBg: 'bg-cu-success-light',
      iconColor: 'text-cu-success',
      icon: <CheckCircle2 size={22} />,
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      borderColor: 'border-cu-success/30',
    },
  };

  const cfg = variantConfig[variant];

  return (
    <div
      className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-cu-border bg-cu-bg shadow-2xl"
        style={{ animation: 'confirmSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-cu-text-tertiary hover:text-cu-text-primary hover:bg-cu-hover transition-all duration-150"
        >
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${cfg.borderColor} ${cfg.iconBg} ${cfg.iconColor}`}>
            {cfg.icon}
          </div>

          {/* Title & Message */}
          <h3 className="text-[16px] font-bold text-cu-text-primary mb-1">{title}</h3>
          <p className="text-[13.5px] text-cu-text-secondary leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-cu-border-light px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-cu-border bg-cu-bg px-4 py-2.5 text-[13.5px] font-semibold text-cu-text-primary hover:bg-cu-hover transition-all duration-150 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnClass}`}
          >
            {loading && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
            {confirmLabel}
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
  );
}
