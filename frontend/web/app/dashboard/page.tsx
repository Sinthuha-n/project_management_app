'use client';

import { useDashboardProjects } from './hooks/useDashboardProjects';
import { useDashboardProfile } from './hooks/useDashboardProfile';
import DashboardHeader from './components/DashboardHeader';
import RecentSpacesSection from './components/recentspaces';
import TabsSection from './components/table/TabsSection';
import PersonalHub from './components/PersonalHub';

export default function DashboardPage() {
  const { user, projects, loading } = useDashboardProjects();
  const { resolvedProfilePicUrl } = useDashboardProfile(user);

  return (
    <div className="flex flex-col gap-4 w-full h-full max-w-[1200px] mx-auto pb-6 mt-0 px-4 sm:px-6 relative">
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


