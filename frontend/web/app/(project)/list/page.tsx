'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Archive, ListChecks, Plus, RefreshCw, Search } from 'lucide-react';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import CreateTaskModal from '@/components/shared/CreateTaskModal';
import EmptyState from '@/components/shared/EmptyState';
import TaskTableHeader from './components/TaskTableHeader';
import TaskRow from './components/TaskRow';
import { useListTasks } from './hooks/useListTasks';
import ListFilterBar, { type ListFilters } from './components/ListFilterBar';
import ListBulkActionBar from './components/ListBulkActionBar';
import { useProjectStatuses } from '@/hooks/useProjectStatuses';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import { stripQueryParam } from '@/lib/url';

// ── Main Page ─────────────────────────────────────────────────────────────

const TASKS_PER_PAGE = 12;

function ListPageContent() {
  const searchParams = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  // Initialise from URL so no setState call is needed inside an effect
  const [showCreateModal, setShowCreateModal] = useState(
    () => searchParams.get('action') === 'add-task',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'priority' | 'assignee'>('none');
  const [filters, setFilters] = useState<ListFilters>({
    search: '',
    statuses: [],
    priorities: [],
    assignee: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const {
    projectId,
    loading,
    error,
    sortedTasks,
    handleStatusChange,
    handleDelete,
    handleAddTask,
    loadTasks,
    showArchived,
    setShowArchived,
    canModifyTasks,
    handleBulkStatusChange,
    handleBulkDelete,
    members,
    labels,
    milestones,
    handleDueDateChange,
    handleAssigneesChange,
    handleToggleTaskLabel,
    handleMilestoneChange,
    handleArchive,
    handleRestore,
  } = useListTasks();
  const { statuses: projectStatuses } = useProjectStatuses(projectId ? Number(projectId) : undefined);

  const allAssigneeNames = useMemo(() => {
    const set = new Set<string>();
    sortedTasks.forEach((task) => {
      if (task.assignees && task.assignees.length > 0) {
        task.assignees.forEach((person) => {
          if (person.name && person.name !== 'Unassigned') set.add(person.name);
        });
      } else if (task.assigneeName && task.assigneeName !== 'Unassigned') {
        set.add(task.assigneeName);
      }
    });
    return Array.from(set).sort();
  }, [sortedTasks]);

  const filteredTasks = useMemo(() => (
    sortedTasks.filter((task) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const inTitle = task.title.toLowerCase().includes(q);
        const inAssignee =
          (task.assigneeName ?? '').toLowerCase().includes(q) ||
          (task.assignees ?? []).some((person) => person.name.toLowerCase().includes(q));
        if (!inTitle && !inAssignee) return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
      if (filters.priorities.length > 0 && !filters.priorities.includes((task.priority ?? '').toUpperCase())) return false;
      if (filters.assignee) {
        const hasAssignee =
          task.assigneeName === filters.assignee ||
          (task.assignees ?? []).some((person) => person.name === filters.assignee);
        if (!hasAssignee) return false;
      }
      return true;
    })
  ), [sortedTasks, filters]);

  const groupedEntries = useMemo(() => {
    if (groupBy === 'none') return [{ label: 'All Tasks', items: filteredTasks }];
    const groups = new Map<string, typeof filteredTasks>();
    filteredTasks.forEach((task) => {
      const key =
        groupBy === 'status'
          ? (task.status || 'TODO').replace(/_/g, ' ')
          : groupBy === 'priority'
            ? (task.priority || 'LOW')
            : ((task.assignees && task.assignees.length > 0 ? task.assignees.map((person) => person.name).join(', ') : task.assigneeName) || 'Unassigned');
      const arr = groups.get(key) ?? [];
      arr.push(task);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  }, [filteredTasks, groupBy]);

  const flatGroupedTasks = useMemo(
    () => groupedEntries.flatMap((entry) => entry.items),
    [groupedEntries]
  );

  const totalPages = Math.max(1, Math.ceil(flatGroupedTasks.length / TASKS_PER_PAGE));
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    return flatGroupedTasks.slice(startIndex, startIndex + TASKS_PER_PAGE);
  }, [currentPage, flatGroupedTasks]);

  // Clean ?action= query param from URL on mount — no setState here
  useEffect(() => {
    stripQueryParam('action');
  }, []);

  useEffect(() => {
    setCurrentPage(1); // eslint-disable-line react-hooks/set-state-in-effect
  }, [filters, groupBy, projectId, showArchived]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [currentPage, totalPages]);

  const selectedCount = selectedIds.size;

  const toggleSelect = (taskId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visible = paginatedTasks.map((task) => task.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = visible.every((id) => next.has(id));
      if (allVisibleSelected) visible.forEach((id) => next.delete(id));
      else visible.forEach((id) => next.add(id));
      return next;
    });
  };

  const allVisibleSelected = paginatedTasks.length > 0 && paginatedTasks.every((task) => selectedIds.has(task.id));

  // ── No project selected ──
  if (!projectId) {
    return (
      <div className="min-h-screen bg-cu-bg-secondary">
        <EmptyState
          icon={<ListChecks size={24} />}
          title="Select a project to view its tasks"
          subtitle="Choose a project from your dashboard to see its task list and continue working."
          action={(
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
            >
              Go to Dashboard
            </Link>
          )}
          className="min-h-[60vh]"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-cu-bg-secondary overflow-y-auto scrollbar-thin">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full animate-fade-in">

        {/* Header */}
        <div className="sticky-section-header glass-panel border border-cu-border/50 rounded-2xl px-4 sm:px-6 py-4 mb-4 flex items-center gap-3 flex-wrap shadow-cu-md">
          <div>
            <h1 className="text-[20px] sm:text-2xl font-extrabold text-cu-text-primary tracking-tight">Task List</h1>
            <p className="text-[12px] sm:text-[13px] text-cu-text-secondary mt-0.5 font-medium">
              {filteredTasks.length} visible of {sortedTasks.length} {showArchived ? 'archived ' : ''}task{sortedTasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3.5 ml-auto">
            <div className="inline-flex rounded-xl border border-cu-border/60 bg-cu-bg p-1 shadow-cu-sm">
              <button
                type="button"
                onClick={() => {
                  setShowArchived(false);
                  setSelectedIds(new Set());
                }}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  !showArchived
                    ? 'bg-cu-primary text-white shadow-sm'
                    : 'text-cu-text-secondary hover:bg-cu-hover/60 hover:text-cu-text-primary'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowArchived(true);
                  setSelectedIds(new Set());
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                  showArchived
                    ? 'bg-cu-primary text-white shadow-sm'
                    : 'text-cu-text-secondary hover:bg-cu-hover/60 hover:text-cu-text-primary'
                }`}
              >
                <Archive size={12} />
                Archived
              </button>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={showArchived || !canModifyTasks}
              title={showArchived ? 'Switch to Active to create tasks' : !canModifyTasks ? 'Viewers cannot create tasks' : 'Create task'}
              className="flex items-center gap-1.5 px-4 py-2 bg-cu-primary text-white text-[12px] font-bold rounded-xl hover:bg-cu-primary-hover shadow-md shadow-cu-primary/10 transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cu-primary cursor-pointer active:scale-95"
            >
              <Plus size={14} />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        <ListFilterBar
          filters={filters}
          onChange={setFilters}
          assigneeNames={allAssigneeNames}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between gap-3 p-4 bg-red-50 dark:bg-cu-danger-light border border-red-200 dark:border-cu-danger/30 rounded-xl text-red-700 dark:text-cu-danger mb-4 flex-wrap">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Error loading tasks</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[42px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="bg-cu-bg rounded-2xl border border-cu-border/50 shadow-cu-sm overflow-hidden transition-all duration-300">
            <TaskTableHeader
              allVisibleSelected={allVisibleSelected}
              toggleSelectAllVisible={toggleSelectAllVisible}
            />
            {flatGroupedTasks.length === 0 ? (
              <EmptyState
                icon={<Search size={24} />}
                title={showArchived ? 'No archived tasks' : (filters.search ? 'No tasks match your search' : 'No tasks yet')}
                subtitle={showArchived ? 'Archived tasks will appear here so they can be restored later.' : (filters.search ? 'Try a different search term or clear the filters.' : 'Create a task to get started.')}
                action={
                  !showArchived && !filters.search ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-cu-primary-hover transition-colors shadow-md shadow-cu-primary/10 cursor-pointer"
                    >
                      <Plus size={14} />
                      Create Task
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="divide-y divide-cu-border/20">
                {paginatedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    members={members}
                    availableLabels={labels}
                    milestones={milestones}
                    onDueDateChange={handleDueDateChange}
                    onAssigneesChange={handleAssigneesChange}
                    onToggleLabel={handleToggleTaskLabel}
                    onMilestoneChange={handleMilestoneChange}
                    selected={selectedIds.has(task.id)}
                    onToggleSelect={toggleSelect}
                    onOpenModal={setSelectedTaskId}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                    onRestore={handleRestore}
                    canModifyTasks={canModifyTasks}
                    showArchived={showArchived}
                    projectStatuses={projectStatuses}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && sortedTasks.length > TASKS_PER_PAGE && (
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-cu-border bg-cu-bg text-[13px] text-cu-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cu-hover transition-colors"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              const isActive = pageNumber === currentPage;

              return (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`min-w-9 h-9 px-3 rounded-lg text-[13px] font-medium border transition-colors ${
                    isActive
                      ? 'bg-cu-primary text-white border-cu-primary'
                      : 'bg-cu-bg text-cu-text-primary border-cu-border hover:bg-cu-hover'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-cu-border bg-cu-bg text-[13px] text-cu-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cu-hover transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <ListBulkActionBar
        selectedCount={selectedCount}
        onStatusChange={(status) => {
          void handleBulkStatusChange(Array.from(selectedIds), status);
          setSelectedIds(new Set());
        }}
        onDelete={() => {
          void handleBulkDelete(Array.from(selectedIds));
          setSelectedIds(new Set());
        }}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Modals */}
      {selectedTaskId !== null && (
        <TaskCardModal
          taskId={selectedTaskId}
          onClose={(wasModified) => { setSelectedTaskId(null); if (wasModified) void loadTasks(); }}
        />
      )}

      {showCreateModal && projectId && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateTask={handleAddTask}
          projectId={projectId}
        />
      )}
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading task list" subtitle="Preparing list data and filters." variant="table" />}>
      <ListPageContent />
    </Suspense>
  );
}
