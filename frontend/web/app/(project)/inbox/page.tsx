// Main UI component for the Chat Inbox page.
// Displays and filters chat conversations grouped by project, consuming state and logic from useInboxData.
'use client';

import { Menu, RefreshCw } from 'lucide-react';
import { InboxPagination } from './components/InboxPagination';
import { ProjectSection } from './components/ProjectSection';
import { useInboxData } from './hooks/useInboxData';
import Link from 'next/link';

// =====================================================
// INBOX PAGE RENDER
// =====================================================
export default function InboxPage() {
  const {
    loading,
    error,
    filter,
    setFilter,
    isMarkingAllRead,
    unreadCount,
    groupedProjects,
    paginatedProjects,
    currentPage,
    totalPages,
    pageSize,
    setPage,
    setPageSize,
    startIndex,
    endIndex,
    totalProjectsCount,
    openActivity,
    markAllAsRead,
    refreshInbox,
  } = useInboxData();

  return (
    <div className="mobile-page-padding w-full max-w-[1200px] mx-auto pb-6 flex flex-col gap-4 sm:gap-5">
      {/* ===================================================== */}
      {/* MOBILE HEADER */}
      {/* ===================================================== */}
      <div className="flex items-center gap-3 py-4 md:hidden">
          <button
              onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
              className="p-2 -ml-2 text-cu-text-secondary hover:bg-cu-hover rounded-lg transition-colors border border-cu-border"
              aria-label="Toggle Sidebar"
          >
              <Menu size={20} />
          </button>
          <div className="font-outfit text-xl font-extrabold tracking-tight text-cu-text-primary flex items-center gap-2">
              <span className="w-2 h-5 bg-cu-primary rounded-full"></span>
              PLANORA
          </div>
      </div>

      {/* ===================================================== */}
      {/* DESKTOP HEADER & FILTERS */}
      {/* ===================================================== */}
      <div className="flex flex-col gap-1 sm:mb-2">
          <div className="flex items-center gap-2 text-[13px] text-cu-text-secondary">
              <Link href="/dashboard" className="hover:text-cu-primary">Dashboard</Link>
              <span>/</span>
              <span className="font-medium text-cu-text-primary">Inbox</span>
          </div>
          <h1 className="font-outfit text-2xl sm:text-[32px] font-bold text-cu-text-primary">Chat Inbox</h1>
          <p className="text-[13px] text-cu-text-secondary sm:mt-1">
            All chat activity grouped by project. Open any conversation directly from here.
          </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold transition-colors ${
            filter === 'all' ? 'bg-cu-primary text-white shadow-cu-sm' : 'bg-cu-bg border border-cu-border text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold transition-colors ${
            filter === 'unread' ? 'bg-cu-primary text-white shadow-cu-sm' : 'bg-cu-bg border border-cu-border text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
          }`}
        >
          Unread Only
        </button>

        <button
          onClick={() => void markAllAsRead()}
          disabled={unreadCount === 0 || loading || isMarkingAllRead}
          className="px-3 py-2 min-h-[44px] rounded-lg text-[13px] sm:text-[12px] font-semibold transition-colors border border-cu-border bg-cu-bg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMarkingAllRead ? 'Marking...' : 'Mark All Read'}
        </button>
      </div>

      {/* ===================================================== */}
      {/* INBOX CONTENT (LOADING / ERROR / EMPTY / LIST) */}
      {/* ===================================================== */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((row) => (
            <div key={row} className="bg-cu-bg border border-cu-border rounded-2xl p-4 animate-pulse shadow-cu-sm">
              <div className="h-4 w-48 bg-cu-bg-tertiary rounded" />
              <div className="h-3 w-32 bg-cu-bg-tertiary rounded mt-2" />
              <div className="h-12 w-full bg-cu-bg-secondary rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="w-full bg-cu-bg border border-cu-danger/25 rounded-2xl p-6 text-center shadow-cu-sm">
          <p className="text-[14px] font-semibold text-cu-danger">{error}</p>
          <button
            onClick={() => void refreshInbox()}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cu-danger/20 bg-cu-danger/10 text-cu-danger text-[12px] font-semibold hover:bg-cu-danger/15"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : groupedProjects.length === 0 ? (
        <div className="w-full bg-cu-bg border border-cu-border rounded-2xl p-6 sm:p-8 shadow-cu-sm">
          <h2 className="text-[16px] font-bold text-cu-text-primary">
            {filter === 'unread' ? 'All caught up!' : 'No chat activity yet'}
          </h2>
          <p className="text-[13px] text-cu-text-secondary mt-1">
            {filter === 'unread'
              ? 'You have no unread messages. Switch to All Activity to browse all conversations.'
              : 'Start a team, room, or direct conversation to populate your inbox.'}
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-4">
          {paginatedProjects.map((group) => (
            <ProjectSection
              key={group.projectId}
              group={group}
              onActivityClick={openActivity}
            />
          ))}

          <InboxPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalProjectsCount}
            startIndex={startIndex}
            endIndex={endIndex}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

