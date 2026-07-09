import { ShieldCheck, UserPlus } from 'lucide-react';
import Button from '@/components/shared/Button';

interface MembersHeaderProps {
  onInviteClick: () => void;
}

export function MembersHeader({ onInviteClick }: MembersHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-cu-border/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cu-primary/15 bg-cu-primary/5 px-2.5 py-1 text-xs font-semibold text-cu-primary">
          <ShieldCheck size={14} aria-hidden="true" />
          Project access
        </div>
        <h1 className="text-[24px] font-semibold leading-tight text-cu-text-primary sm:text-[28px]">Team Members</h1>
        <p className="mt-1 max-w-2xl text-sm text-cu-text-secondary">
          Review who can access this project, adjust roles, and invite collaborators.
        </p>
      </div>
      <Button
        variant="primary"
        size="lg"
        leftIcon={<UserPlus size={18} />}
        className="w-full rounded-cu-lg px-4 sm:w-auto"
        onClick={onInviteClick}
      >
        Invite Member
      </Button>
    </div>
  );
}
