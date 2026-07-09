"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useMembersData } from "./useMembersData";
import { ROLE_OPTIONS } from "./constants";
import { InviteMemberModal } from "./components/InviteMemberModal";
import { MembersFilters } from "./components/MembersFilters";
import { MembersHeader } from "./components/MembersHeader";
import { MembersStatsCards } from "./components/MembersStatsCards";
import { MembersTable } from "./components/MembersTable";
import { RemoveMemberModal } from "./components/RemoveMemberModal";

export default function MembersPageClient({ projectId, pageSize }: { projectId: string; pageSize?: number }) {
  const searchParams = useSearchParams();
  const hasAutoOpenedInvite = useRef(false);

  const {
    loading, filteredMembers, totalMembers, activeCount, adminCount, pendingCount,
    search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    showFilters, setShowFilters,
    showModal, setShowModal, inviteEmail, setInviteEmail, inviteRole, setInviteRole,
    inviteLoading, inviteError, inviteSuccess,
    roleChangeError, roleChangeSuccess, changingRoleId,
    showRemoveModal, setShowRemoveModal, memberToRemove, setMemberToRemove,
    removeLoading, removeError, setRemoveError, removeSuccess,
    brokenProfileImages, setBrokenProfileImages,
    canChangeRole, canRemoveMember, getAvailableOptions,
    resolveProfilePicUrl, getMemberProfilePicCandidates,
    handleRoleChange, handleRemoveMemberConfirm, handleInvite,
  } = useMembersData(projectId);

  useEffect(() => {
    if (hasAutoOpenedInvite.current) return;

    const shouldOpenInvite = searchParams?.get?.('invite') === 'true';
    if (!shouldOpenInvite) return;

    setShowModal(true);
    hasAutoOpenedInvite.current = true;
  }, [searchParams, setShowModal]);

  if (loading) return <div className="mobile-page-padding mx-auto max-w-6xl pb-6 text-sm text-cu-text-muted">Loading...</div>;

  return (
    <div className="mobile-page-padding mx-auto max-w-6xl pb-8">
      <div className="space-y-5 sm:space-y-6">
        <MembersHeader onInviteClick={() => setShowModal(true)} />

        {(roleChangeSuccess || roleChangeError || removeSuccess) && (
          <div className="space-y-3">
            {roleChangeSuccess && (
              <div className="rounded-cu-md border border-cu-success/20 bg-cu-success-light p-3 text-sm font-medium text-cu-success shadow-cu-sm">
                {roleChangeSuccess}
              </div>
            )}
            {roleChangeError && (
              <div className="rounded-cu-md border border-cu-danger/20 bg-cu-danger-light p-3 text-sm font-medium text-cu-danger shadow-cu-sm">
                {roleChangeError}
              </div>
            )}
            {removeSuccess && (
              <div className="rounded-cu-md border border-cu-success/20 bg-cu-success-light p-3 text-sm font-medium text-cu-success shadow-cu-sm">
                {removeSuccess}
              </div>
            )}
          </div>
        )}

        <MembersStatsCards
          totalMembers={totalMembers}
          activeCount={activeCount}
          adminCount={adminCount}
          pendingCount={pendingCount}
        />

        <MembersFilters
          search={search}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          showFilters={showFilters}
          onSearchChange={setSearch}
          onToggleFilters={() => setShowFilters((current) => !current)}
          onRoleFilterChange={setRoleFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <MembersTable
          filteredMembers={filteredMembers}
          brokenProfileImages={brokenProfileImages}
          changingRoleId={changingRoleId}
          canChangeRole={canChangeRole}
          canRemoveMember={canRemoveMember}
          getAvailableOptions={getAvailableOptions}
          resolveProfilePicUrl={resolveProfilePicUrl}
          getMemberProfilePicCandidates={getMemberProfilePicCandidates}
          setBrokenProfileImages={setBrokenProfileImages}
          onRoleChange={(userId, newRole) => {
            void handleRoleChange(userId, newRole);
          }}
          onRequestRemove={(member) => {
            setMemberToRemove(member);
            setShowRemoveModal(true);
            setRemoveError("");
          }}
          pageSize={pageSize}
        />
      </div>

      <InviteMemberModal
        isOpen={showModal}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteLoading={inviteLoading}
        inviteError={inviteError}
        inviteSuccess={inviteSuccess}
        roleOptions={ROLE_OPTIONS.filter((role) => role !== 'OWNER')}
        onClose={() => setShowModal(false)}
        onInviteEmailChange={setInviteEmail}
        onInviteRoleChange={setInviteRole}
        onSubmit={handleInvite}
      />

      <RemoveMemberModal
        isOpen={showRemoveModal}
        memberToRemove={memberToRemove}
        removeLoading={removeLoading}
        removeError={removeError}
        onClose={() => {
          setShowRemoveModal(false);
          setMemberToRemove(null);
          setRemoveError("");
        }}
        onConfirm={() => {
          void handleRemoveMemberConfirm();
        }}
      />
    </div>
  );
}
