import type React from 'react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Clock3, ListChecks, Mail, Trash2 } from 'lucide-react';
import { ROLE_COLORS, ROLE_LABELS, STATUS_COLORS, ICONS } from '../constants';
import type { AssignableTeamRole, Member, MemberCombined } from '../types';
import { paginateMembers, timeAgo } from '../utils';
import { MembersPagination } from './MembersPagination';
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip';


interface MembersTableProps {
  filteredMembers: MemberCombined[];
  brokenProfileImages: Record<string, boolean>;
  changingRoleId: number | null;
  canChangeRole: (member: MemberCombined) => boolean;
  canRemoveMember: (member: MemberCombined) => boolean;
  getAvailableOptions: (member: MemberCombined) => AssignableTeamRole[];
  resolveProfilePicUrl: (profilePicUrl?: string) => string;
  getMemberProfilePicCandidates: (member: Member) => string[];
  setBrokenProfileImages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onRoleChange: (userId: number, newRole: AssignableTeamRole) => void;
  onRequestRemove: (member: MemberCombined) => void;
  pageSize?: number;
}

interface MemberAvatarProps {
  member: MemberCombined;
  brokenProfileImages: Record<string, boolean>;
  resolveProfilePicUrl: (profilePicUrl?: string) => string;
  getMemberProfilePicCandidates: (member: Member) => string[];
  setBrokenProfileImages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  sizeClassName?: string;
}

function getInitials(member: MemberCombined) {
  if (member.user.fullName) {
    return member.user.fullName
      .split(' ')
      .map((name) => name[0])
      .join('');
  }

  return member.user.email[0]?.toUpperCase();
}

function useIsMobileMembersView() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = () => setIsMobile(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

function MemberAvatar({
  member,
  brokenProfileImages,
  resolveProfilePicUrl,
  getMemberProfilePicCandidates,
  setBrokenProfileImages,
  sizeClassName = 'w-9 h-9',
}: MemberAvatarProps) {
  const avatarKey = `${member.id}-${member.user.email}`;
  const resolvedCandidates = getMemberProfilePicCandidates(member)
    .map((url) => resolveProfilePicUrl(url))
    .filter(Boolean);
  const resolvedProfilePicUrl = resolvedCandidates.find(
    (url) => !brokenProfileImages[`${avatarKey}:${url}`],
  ) || '';

  if (resolvedProfilePicUrl && !brokenProfileImages[avatarKey]) {
    return (
      <Image
        src={resolvedProfilePicUrl}
        alt={member.user.fullName || member.user.email}
        width={44}
        height={44}
        unoptimized={true}
        className={`${sizeClassName} rounded-full object-cover shrink-0`}
        onError={() => setBrokenProfileImages((prev) => ({ ...prev, [`${avatarKey}:${resolvedProfilePicUrl}`]: true }))}
      />
    );
  }

  return (
    <div className={`${sizeClassName} rounded-full bg-cu-primary/10 ring-1 ring-cu-primary/20 flex items-center justify-center text-cu-primary font-bold text-base shrink-0`}>
      {getInitials(member)}
    </div>
  );
}

interface RoleControlProps {
  member: MemberCombined;
  changingRoleId: number | null;
  canChangeRole: (member: MemberCombined) => boolean;
  getAvailableOptions: (member: MemberCombined) => AssignableTeamRole[];
  onRoleChange: (userId: number, newRole: AssignableTeamRole) => void;
  compact?: boolean;
}

function RoleControl({
  member,
  changingRoleId,
  canChangeRole,
  getAvailableOptions,
  onRoleChange,
  compact = false,
}: RoleControlProps) {
  const role = String(member.role || '').toUpperCase();

  if (role === 'OWNER') {
    return (
      <span className={`inline-flex w-max items-center gap-1.5 rounded-full px-2.5 leading-none ${compact ? 'h-8 text-xs' : 'h-9 text-sm'} font-semibold ${ROLE_COLORS.OWNER}`}>
        {ICONS.owner}
        {ROLE_LABELS.OWNER}
      </span>
    );
  }

  if (canChangeRole(member) && member.user.userId) {
    return (
      <div className="relative inline-flex items-center w-full sm:w-auto">
        <select
          value={role}
          onChange={(event) => onRoleChange(member.user.userId, event.target.value as AssignableTeamRole)}
          disabled={changingRoleId === member.user.userId}
          aria-label={`Change role for ${member.user.fullName || member.user.email}`}
          className={`h-10 w-full cursor-pointer appearance-none rounded-full border border-transparent pl-8 pr-8 text-sm font-semibold leading-none outline-none ring-1 ring-transparent transition-all focus:ring-cu-primary/25 disabled:cursor-wait sm:w-auto ${ROLE_COLORS[role] || 'bg-cu-bg-tertiary text-cu-text-secondary'}`}
        >
          {getAvailableOptions(member).map((opt) => (
            <option key={opt} value={opt}>{ROLE_LABELS[opt] || opt}</option>
          ))}
        </select>
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-3.5 h-3.5">
          {role === 'ADMIN' && ICONS.adminRole}
          {role === 'MEMBER' && ICONS.member}
          {role === 'VIEWER' && ICONS.viewer}
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
          {changingRoleId === member.user.userId ? (
            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
            <ChevronDown size={13} aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex w-max items-center gap-1.5 rounded-full px-2.5 leading-none ${compact ? 'h-8 text-xs' : 'h-9 text-sm'} font-semibold ${ROLE_COLORS[role] || 'bg-cu-bg-tertiary text-cu-text-secondary'}`}>
      {role === 'ADMIN' && ICONS.adminRole}
      {role === 'MEMBER' && ICONS.member}
      {role === 'VIEWER' && ICONS.viewer}
      {ROLE_LABELS[role] || member.role}
    </span>
  );
}

export function MembersTable({
  filteredMembers,
  brokenProfileImages,
  changingRoleId,
  canChangeRole,
  canRemoveMember,
  getAvailableOptions,
  resolveProfilePicUrl,
  getMemberProfilePicCandidates,
  setBrokenProfileImages,
  onRoleChange,
  onRequestRemove,
  pageSize = 10,
}: MembersTableProps) {
  const isMobile = useIsMobileMembersView();
  const [page, setPage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(pageSize);

  useEffect(() => {
    if (typeof pageSize === 'number' && pageSize > 0) {
      setActivePageSize(pageSize);
    }
  }, [pageSize]);

  const safePageSize = Math.max(1, activePageSize);
  const totalFilteredCount = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / safePageSize));

  // Safe page correction if the list shrinks under current page
  const currentPage = Math.min(page, totalPages);

  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalFilteredCount);
  const paginatedMembers = paginateMembers(filteredMembers, currentPage, safePageSize);

  const renderPagination = () => (
    <MembersPagination
      currentPage={currentPage}
      totalPages={totalPages}
      pageSize={safePageSize}
      totalItems={totalFilteredCount}
      startIndex={startIndex}
      endIndex={endIndex}
      onPageChange={setPage}
      onPageSizeChange={(newSize) => {
        setActivePageSize(newSize);
        setPage(1);
      }}
    />
  );


  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {paginatedMembers.map((member) => (
            <article key={`mobile-${member.id}-${member.user.email}`} className="rounded-cu-lg border border-cu-border bg-cu-bg p-4 shadow-cu-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <MemberAvatar
                    member={member}
                    brokenProfileImages={brokenProfileImages}
                    resolveProfilePicUrl={resolveProfilePicUrl}
                    getMemberProfilePicCandidates={getMemberProfilePicCandidates}
                    setBrokenProfileImages={setBrokenProfileImages}
                    sizeClassName="w-11 h-11"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold text-cu-text-primary">{member.user.fullName || member.user.email}</h2>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-cu-text-muted">
                      <Mail size={12} aria-hidden="true" />
                      <span className="truncate">{member.user.email}</span>
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[member.status] || 'bg-cu-bg-tertiary text-cu-text-secondary'}`}>{member.status}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-cu-md bg-cu-bg-secondary p-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-cu-text-muted">
                    <Clock3 size={12} aria-hidden="true" />
                    Last active
                  </p>
                  <p className="mt-1 text-sm font-semibold text-cu-text-primary">{member.status === 'Pending' ? 'Never' : member.lastActive ? timeAgo(member.lastActive) : '-'}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-cu-text-muted">
                    <ListChecks size={12} aria-hidden="true" />
                    Tasks
                  </p>
                  <p className="mt-1 text-sm font-semibold text-cu-primary">{member.taskCount}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <RoleControl
                  member={member}
                  changingRoleId={changingRoleId}
                  canChangeRole={canChangeRole}
                  getAvailableOptions={getAvailableOptions}
                  onRoleChange={onRoleChange}
                  compact
                />
                {canRemoveMember(member) && (
                  <button
                    onClick={() => onRequestRemove(member)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-cu-md border border-cu-danger/20 bg-cu-danger-light px-3 text-sm font-semibold text-cu-danger transition-colors hover:bg-cu-danger/15"
                    title="Remove Member"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))}
          {totalFilteredCount === 0 && (
            <div className="rounded-cu-lg border border-dashed border-cu-border bg-cu-bg px-4 py-10 text-center text-sm text-cu-text-muted">
              No members found.
            </div>
          )}
        </div>
        {renderPagination()}
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="overflow-hidden rounded-cu-lg border border-cu-border bg-cu-bg shadow-cu-sm">
      <div
        className="relative overflow-x-auto mobile-scroll touch-pan-x"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="min-w-full text-sm">
          <thead className="bg-cu-bg-secondary">
            <tr className="border-b border-cu-border">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-cu-text-muted whitespace-nowrap">
                Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-cu-text-muted whitespace-nowrap">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-cu-text-muted whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-cu-text-muted whitespace-nowrap">Last Active</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-cu-text-muted whitespace-nowrap">Tasks</th>
              <th className="px-4 py-3 whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.map((member) => (
                <tr key={member.id + member.user.email} className="border-b border-cu-border last:border-b-0 hover:bg-cu-hover/70">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                    <MemberAvatar
                      member={member}
                      brokenProfileImages={brokenProfileImages}
                      resolveProfilePicUrl={resolveProfilePicUrl}
                      getMemberProfilePicCandidates={getMemberProfilePicCandidates}
                      setBrokenProfileImages={setBrokenProfileImages}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-cu-text-primary">{member.user.fullName || member.user.email}</div>
                      <div className="truncate text-xs text-cu-text-muted">{member.user.email}</div>
                    </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-middle whitespace-nowrap">
                    <RoleControl
                      member={member}
                      changingRoleId={changingRoleId}
                      canChangeRole={canChangeRole}
                      getAvailableOptions={getAvailableOptions}
                      onRoleChange={onRoleChange}
                    />
                  </td>

                  <td className="px-4 py-4 align-middle whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[member.status] || 'bg-cu-bg-tertiary text-cu-text-secondary'}`}>{member.status}</span>
                  </td>

                  <td className="px-4 py-4 align-middle whitespace-nowrap text-sm text-cu-text-secondary">
                    {member.status === 'Pending' ? 'Never' : member.lastActive ? timeAgo(member.lastActive) : '-'}
                  </td>

                  <td className="px-4 py-4 align-middle whitespace-nowrap">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-cu-primary/10 px-2 text-sm font-semibold text-cu-primary">
                      {member.taskCount}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right align-middle whitespace-nowrap">
                    {canRemoveMember(member) && (
                      <Tooltip content="Remove member">
                        <button
                          onClick={() => onRequestRemove(member)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-transparent text-cu-text-muted transition-colors hover:border-cu-danger/20 hover:bg-cu-danger-light hover:text-cu-danger"
                          title="Remove Member"
                          aria-label="Remove"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))}
              {totalFilteredCount === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-cu-text-muted">No members found.</td>
                </tr>
              )}
            </tbody>
          </table>
      </div>
      {renderPagination()}
    </div>
    </TooltipProvider>
  );
}
