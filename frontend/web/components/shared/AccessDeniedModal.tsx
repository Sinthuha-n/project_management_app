'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import OverlayPortal from '@/components/ui/OverlayPortal';
import { ACCESS_DENIED_MESSAGE, ACCESS_DENIED_TITLE } from '@/lib/project-permissions';

export interface AccessDeniedModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  buttonText?: string;
}

export default function AccessDeniedModal({
  open,
  onClose,
  title = ACCESS_DENIED_TITLE,
  message = ACCESS_DENIED_MESSAGE,
  buttonText = 'Understood',
}: AccessDeniedModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-denied-title"
        aria-describedby="access-denied-message"
        className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(16, 24, 40, 0.6)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="relative w-full max-w-sm mx-4 rounded-2xl border border-cu-border bg-cu-bg shadow-2xl"
          style={{ animation: 'accessDeniedSlideIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1 text-cu-text-tertiary hover:text-cu-text-primary hover:bg-cu-hover transition-all duration-150"
          >
            <X size={16} />
          </button>

          <div className="p-6">
            {/* Warning / Shield Icon */}
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-cu-danger/30 bg-cu-danger-light text-cu-danger shadow-sm">
              <ShieldAlert size={24} />
            </div>

            {/* Title & Message */}
            <h3 id="access-denied-title" className="text-[16px] font-bold text-cu-text-primary mb-1.5">
              {title}
            </h3>
            <p id="access-denied-message" className="text-[13.5px] text-cu-text-secondary leading-relaxed">
              {message}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-cu-border-light px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-cu-primary hover:bg-cu-primary-hover px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-all duration-150 active:scale-95"
            >
              {buttonText}
            </button>
          </div>

          <style>{`
            @keyframes accessDeniedSlideIn {
              from { opacity: 0; transform: scale(0.92) translateY(10px); }
              to   { opacity: 1; transform: scale(1)   translateY(0); }
            }
          `}</style>
        </div>
      </div>
    </OverlayPortal>
  );
}
