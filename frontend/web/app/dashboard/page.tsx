'use client';

import { useDashboardProjects } from './hooks/useDashboardProjects';
import { useDashboardProfile } from './hooks/useDashboardProfile';
import DashboardHeader from './components/DashboardHeader';
import RecentSpacesSection from './components/recentspaces';
import TabsSection from './components/table/TabsSection';
import PersonalHub from './components/PersonalHub';

export default function DashboardPage() {
  const { user, projects, loading, isOfflineReadOnly, isOfflineUnavailable } = useDashboardProjects();
  const { resolvedProfilePicUrl } = useDashboardProfile(user);

  if (isOfflineUnavailable) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <div className="max-w-xl rounded-2xl border border-cu-warning/30 bg-cu-bg p-6 text-center shadow-cu-sm">
          <h2 className="text-lg font-bold text-cu-text-primary">No cached dashboard available</h2>
          <p className="mt-2 text-sm text-cu-text-secondary">
            Reconnect once to load your dashboard, then Planora can show recent workspace data here while offline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full max-w-[1200px] mx-auto pb-6 mt-0 px-4 sm:px-6 relative">
      {isOfflineReadOnly && (
        <div className="rounded-cu-xl border border-cu-warning/30 bg-cu-warning-light px-4 py-3 text-sm text-cu-text-primary shadow-cu-sm">
          <span className="font-bold">Offline read-only mode.</span>{' '}
          <span className="text-cu-text-secondary">Showing cached dashboard spaces until your connection returns.</span>
        </div>
      )}

      {/* ── Header: greeting + notification bell + avatar ── */}
      <DashboardHeader user={user} resolvedProfilePicUrl={resolvedProfilePicUrl} />

      {/* ── Recent Spaces: search, filter, carousel ── */}
      <RecentSpacesSection projects={projects} loading={loading} />

      {/* ── Content Grid: Main Table + Personal Hub Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 sm:gap-8 items-start mt-2">
        <div className="lg:col-span-7 w-full min-w-0">
          <TabsSection />
        </div>
        <div className="lg:col-span-3 w-full shrink-0">
          <PersonalHub userId={user?.userId?.toString()} />
        </div>
      </div>
    </div>
  );
}
