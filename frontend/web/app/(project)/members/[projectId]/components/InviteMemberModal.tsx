'use client';

import type { FormEvent } from 'react';
import { ChevronDown, Mail, Send, ShieldCheck } from 'lucide-react';
import Button from '@/components/shared/Button';
import { Modal } from '@/components/ui/Modal';
import { ROLE_LABELS } from '../constants';

interface InviteMemberModalProps {
  isOpen: boolean;
  inviteEmail: string;
  inviteRole: string;
  inviteLoading: boolean;
  inviteError: string;
  inviteSuccess: string;
  roleOptions: string[];
  onClose: () => void;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function InviteMemberModal({
  isOpen,
  inviteEmail,
  inviteRole,
  inviteLoading,
  inviteError,
  inviteSuccess,
  roleOptions,
  onClose,
  onInviteEmailChange,
  onInviteRoleChange,
  onSubmit,
}: InviteMemberModalProps) {
  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Invite Team Member"
      description="Send a project invitation with the right access level."
      size="md"
      className="mx-4 overflow-hidden"
    >
        <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-cu-text-muted">Email Address <span className="text-cu-danger">*</span></label>
            <div className="relative">
              <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cu-text-muted" aria-hidden="true" />
              <input
                type="email"
                className="h-11 w-full rounded-cu-md border border-cu-border bg-cu-bg text-cu-text-primary pl-10 pr-3 text-sm shadow-cu-sm transition-colors placeholder:text-cu-text-muted focus:border-cu-primary/40 focus:outline-none focus:ring-2 focus:ring-cu-primary/15"
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-cu-text-muted">Role <span className="text-cu-danger">*</span></label>
            <div className="relative">
              <ShieldCheck size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cu-text-muted" aria-hidden="true" />
              <select
                className="h-11 w-full appearance-none rounded-cu-md border border-cu-border bg-cu-bg text-cu-text-primary pl-10 pr-9 text-sm shadow-cu-sm transition-colors focus:border-cu-primary/40 focus:outline-none focus:ring-2 focus:ring-cu-primary/15"
                value={inviteRole}
                onChange={(e) => onInviteRoleChange(e.target.value)}
                required
              >
                <option value="">Select a role</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cu-text-muted" aria-hidden="true" />
            </div>
            {!inviteRole && (
              <div className="mt-1 text-xs text-cu-danger">Please select a role.</div>
            )}
          </div>
          {inviteError && <div className="rounded-cu-md border border-cu-danger/20 bg-cu-danger-light px-3 py-2 text-sm font-medium text-cu-danger">{inviteError}</div>}
          {inviteSuccess && <div className="rounded-cu-md border border-cu-success/20 bg-cu-success-light px-3 py-2 text-sm font-medium text-cu-success">{inviteSuccess}</div>}
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="sm:min-w-[120px]"
              onClick={onClose}
              disabled={inviteLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="sm:min-w-[140px]"
              isLoading={inviteLoading}
              leftIcon={<Send size={16} />}
            >
              Send Invite
            </Button>
          </div>
        </form>
    </Modal>
  );
}
