'use client';

import type { MemberCombined } from '../types';
import { Trash2, X } from 'lucide-react';
import Button from '@/components/shared/Button';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface RemoveMemberModalProps {
  isOpen: boolean;
  memberToRemove: MemberCombined | null;
  removeLoading: boolean;
  removeError: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveMemberModal({
  isOpen,
  memberToRemove,
  removeLoading,
  removeError,
  onClose,
  onConfirm,
}: RemoveMemberModalProps) {
  if (!isOpen || !memberToRemove) return null;

  return (
    <OverlayPortal>
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-[var(--cu-z-modal)] p-4 sm:p-0">
      <div className="bg-cu-bg rounded-lg shadow-lg p-4 sm:p-8 w-full max-w-sm relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-cu-hover text-cu-text-muted"
        >
          <X size={18} />
        </button>
        <h2 className="text-xl font-bold mb-4 text-cu-text-primary">Remove Member</h2>
        <p className="text-xs sm:text-sm text-cu-text-secondary mb-6 leading-relaxed">
          Are you sure you want to remove <strong>{memberToRemove.user.fullName || memberToRemove.user.email}</strong> from this project? This action cannot be undone.
        </p>
        {removeError && <div className="text-cu-danger text-sm mb-4">{removeError}</div>}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={onClose}
            disabled={removeLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="lg"
            className="flex-1"
            onClick={onConfirm}
            isLoading={removeLoading}
            leftIcon={<Trash2 size={16} />}
          >
            Remove Member
          </Button>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}
