'use client';

import type { MemberCombined } from '../types';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Button from '@/components/shared/Button';
import { Modal } from '@/components/ui/Modal';

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
  if (!memberToRemove) return null;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remove Member"
      description="This will revoke project access for the selected member."
      size="sm"
      className="mx-4 overflow-hidden"
    >
        <div className="pt-2">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-cu-lg bg-cu-danger-light text-cu-danger">
            <AlertTriangle size={21} aria-hidden="true" />
          </div>
        <p className="mb-5 text-sm leading-relaxed text-cu-text-secondary">
          Are you sure you want to remove <strong>{memberToRemove.user.fullName || memberToRemove.user.email}</strong> from this project? This action cannot be undone.
        </p>
        {removeError && <div className="mb-4 rounded-cu-md border border-cu-danger/20 bg-cu-danger-light px-3 py-2 text-sm font-medium text-cu-danger">{removeError}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="sm:min-w-[112px]"
            onClick={onClose}
            disabled={removeLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="lg"
            className="sm:min-w-[150px]"
            onClick={onConfirm}
            isLoading={removeLoading}
            leftIcon={<Trash2 size={16} />}
          >
            Remove Member
          </Button>
        </div>
      </div>
    </Modal>
  );
}
