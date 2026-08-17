'use client';

import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export interface LogoutConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  isLoggingOut?: boolean;
}

export function LogoutConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  isLoggingOut = false,
}: LogoutConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isLoggingOut) {
          onOpenChange(isOpen);
        }
      }}
      size="sm"
      className="p-0 overflow-hidden"
    >
      <div className="pt-6 px-6 pb-2 text-center flex flex-col items-center">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 ring-8 ring-red-500/5">
          <LogOut size={26} strokeWidth={2.2} className="translate-x-0.5" />
        </div>

        {/* Title */}
        <h2 className="text-[19px] font-bold text-cu-text-primary tracking-tight font-outfit">
          Log out of Planora?
        </h2>

        {/* Description */}
        <p className="mt-2 text-sm text-cu-text-secondary leading-relaxed">
          Are you sure you want to log out? You will need to sign in again to access your projects and tasks.
        </p>

        {/* Security / Cache notice */}
        <div className="mt-4 w-full bg-cu-bg-secondary border border-cu-border rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-left">
          <ShieldAlert size={16} className="text-amber-500 shrink-0" />
          <span className="text-[12px] text-cu-text-muted leading-tight">
            All cached session data and offline storage on this browser will be securely cleared.
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 px-6 pb-6 flex items-center justify-end gap-2.5 w-full">
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={() => onOpenChange(false)}
          className="flex-1 h-10 px-4 rounded-xl border border-cu-border bg-cu-bg hover:bg-cu-hover text-sm font-semibold text-cu-text-secondary hover:text-cu-text-primary transition-all duration-150 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={() => void onConfirm()}
          className="flex-1 h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-semibold shadow-sm shadow-red-500/20 transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLoggingOut ? (
            <>
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Logging out…</span>
            </>
          ) : (
            <>
              <LogOut size={15} strokeWidth={2.2} />
              <span>Log Out</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

export default LogoutConfirmModal;
