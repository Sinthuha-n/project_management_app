import type { FormEvent } from 'react';
import { Send, X } from 'lucide-react';
import Button from '@/components/shared/Button';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-[var(--cu-z-modal)] p-4 sm:p-0">
      <div className="bg-cu-bg rounded-lg shadow-lg p-4 sm:p-8 w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded hover:bg-cu-hover text-cu-text-muted"
        >
          <X size={18} />
        </button>
        <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">Email Address <span className="text-red-500">*</span></label>
            <input
              type="email"
              className="w-full border border-cu-border bg-cu-bg text-cu-text-primary rounded px-3 py-2.5 min-h-[44px] text-sm focus:outline-none focus:border-cu-primary"
              value={inviteEmail}
              onChange={(e) => onInviteEmailChange(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">Role <span className="text-red-500">*</span></label>
            <select
              className="w-full border border-cu-border bg-cu-bg text-cu-text-primary rounded px-3 py-2.5 min-h-[44px] text-sm focus:outline-none focus:border-cu-primary"
              value={inviteRole}
              onChange={(e) => onInviteRoleChange(e.target.value)}
              required
            >
              <option value="">Select a role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {!inviteRole && (
              <div className="text-red-500 text-xs mt-1">Please select a role.</div>
            )}
          </div>
          {inviteError && <div className="text-cu-danger text-sm">{inviteError}</div>}
          {inviteSuccess && <div className="text-emerald-500 text-sm">{inviteSuccess}</div>}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={onClose}
              disabled={inviteLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="flex-1"
              isLoading={inviteLoading}
              leftIcon={<Send size={16} />}
            >
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
