'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Edit2,
  Flag,
  Kanban,
  Layers3,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { tasksApi } from '@/services/api-contract';
import { assignTaskToMilestone, createMilestone, deleteMilestone, getMilestones, updateMilestone } from '@/services/milestone-service';
import type { MilestoneResponse, Task } from '@/types';
import MilestoneForm, { type MilestoneFormData } from './components/MilestoneForm';
import {
  buildMilestoneViewModels,
  filterMilestones,
  formatDueLabel,
  getHealthLabel,
  getMilestoneStats,
  getStatusLabel,
  sortMilestones,
  type MilestoneDueBucket,
  type MilestoneFilters,
  type MilestoneHealth,
  type MilestoneSort,
  type MilestoneView,
  type MilestoneViewModel,
} from './components/milestone-utils';
import { STATUS_CONFIG, type MilestoneStatus } from './components/milestoneConfig';

const DEFAULT_FILTERS: MilestoneFilters = {
  search: '',
  status: 'ALL',
  due: 'all',
  sort: 'dueDate',
};

const HEALTH_STYLE: Record<MilestoneHealth, string> = {
  'on-track': 'border-cu-success/30 bg-cu-success/10 text-cu-success',
  'at-risk': 'border-cu-warning/30 bg-cu-warning/10 text-cu-warning',
  overdue: 'border-cu-danger/30 bg-cu-danger/10 text-cu-danger',
  complete: 'border-cu-success/30 bg-cu-success/10 text-cu-success',
  cancelled: 'border-cu-border bg-cu-bg-secondary text-cu-text-secondary',
};

const HEALTH_COLUMNS: Array<{ key: MilestoneHealth; label: string; icon: typeof Flag }> = [
  { key: 'overdue', label: 'Overdue', icon: AlertCircle },
  { key: 'at-risk', label: 'At risk', icon: Clock3 },
  { key: 'on-track', label: 'On track', icon: Flag },
  { key: 'complete', label: 'Complete', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', icon: CircleDashed },
];

function dispatchMilestoneUpdated() {
  window.dispatchEvent(new CustomEvent('planora:milestone-updated'));
}

function compactDate(value?: string) {
  if (!value) return 'No date';
  return new Date(`${value.substring(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MilestoneProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-cu-bg-secondary">
      <div
        className="h-full rounded-full bg-cu-primary transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
  );
}

function HealthPill({ health }: { health: MilestoneHealth }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${HEALTH_STYLE[health]}`}>
      {getHealthLabel(health)}
    </span>
  );
}

function StatusSelect({
  milestone,
  onChange,
}: {
  milestone: MilestoneViewModel;
  onChange: (id: number, status: MilestoneStatus) => void;
}) {
  return (
    <select
      value={milestone.status}
      onChange={(event) => onChange(milestone.id, event.target.value as MilestoneStatus)}
      className="h-9 rounded-cu-md border border-cu-border bg-cu-bg px-2 text-xs font-bold text-cu-text-primary outline-none transition-colors focus:border-cu-primary"
      aria-label={`Change status for ${milestone.name}`}
    >
      {(Object.keys(STATUS_CONFIG) as MilestoneStatus[]).map((status) => (
        <option key={status} value={status}>{getStatusLabel(status)}</option>
      ))}
    </select>
  );
}

function MilestoneCard({
  milestone,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  milestone: MilestoneViewModel;
  selected: boolean;
  onSelect: (milestone: MilestoneViewModel) => void;
  onEdit: (milestone: MilestoneViewModel) => void;
  onDelete: (milestone: MilestoneViewModel) => void;
  onStatusChange: (id: number, status: MilestoneStatus) => void;
}) {
  return (
    <article
      className={`rounded-cu-lg border bg-cu-bg p-4 shadow-cu-sm transition-all hover:border-cu-primary/40 hover:shadow-cu-md ${
        selected ? 'border-cu-primary ring-2 ring-cu-primary/15' : 'border-cu-border'
      }`}
    >
      <button type="button" onClick={() => onSelect(milestone)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Flag size={15} className={milestone.health === 'complete' ? 'text-cu-success' : 'text-cu-primary'} />
              <h3 className="truncate text-sm font-extrabold text-cu-text-primary">{milestone.name}</h3>
            </div>
            <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs font-medium text-cu-text-secondary">
              {milestone.description || 'No description added.'}
            </p>
          </div>
          <ChevronRight size={16} className="mt-1 shrink-0 text-cu-text-muted" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <HealthPill health={milestone.health} />
          <span className={`text-xs font-bold ${milestone.isOverdue ? 'text-cu-danger' : 'text-cu-text-secondary'}`}>
            {formatDueLabel(milestone)}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold text-cu-text-primary">{milestone.progress}% complete</span>
            <span className="font-medium text-cu-text-muted">{milestone.completedTasks}/{milestone.linkedTasks} tasks</span>
          </div>
          <MilestoneProgressBar progress={milestone.progress} />
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-cu-border pt-3">
        <StatusSelect milestone={milestone} onChange={onStatusChange} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(milestone)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-cu-border text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
            aria-label={`Edit ${milestone.name}`}
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(milestone)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-cu-border text-cu-danger transition-colors hover:bg-cu-danger/10"
            aria-label={`Delete ${milestone.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function TaskRow({
  task,
  onOpen,
  onRemove,
}: {
  task: Task;
  onOpen: (taskId: number) => void;
  onRemove?: (task: Task) => void;
}) {
  return (
    <div className="flex min-h-[56px] items-center gap-3 rounded-cu-md border border-cu-border bg-cu-bg px-3 py-2">
      <button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-bold text-cu-text-primary">{task.title}</p>
        <p className="mt-0.5 text-xs font-medium text-cu-text-muted">
          {task.status || 'No status'} · {task.assigneeName || task.assignees?.[0]?.name || 'Unassigned'} · {task.dueDate ? compactDate(task.dueDate) : 'No due date'}
        </p>
      </button>
      <span className="rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-bold text-cu-text-secondary">
        {task.priority || 'MEDIUM'}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(task)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md text-cu-text-muted transition-colors hover:bg-cu-danger/10 hover:text-cu-danger"
          aria-label={`Remove ${task.title} from milestone`}
        >
          <Unlink size={14} />
        </button>
      )}
    </div>
  );
}

function MilestoneBoard(props: {
  milestones: MilestoneViewModel[];
  selectedId?: number;
  onSelect: (milestone: MilestoneViewModel) => void;
  onEdit: (milestone: MilestoneViewModel) => void;
  onDelete: (milestone: MilestoneViewModel) => void;
  onStatusChange: (id: number, status: MilestoneStatus) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {HEALTH_COLUMNS.map((column) => {
        const Icon = column.icon;
        const items = props.milestones.filter((milestone) => milestone.health === column.key);
        return (
          <section key={column.key} className="min-h-[240px] rounded-cu-lg border border-cu-border bg-cu-bg-secondary p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-black uppercase text-cu-text-secondary">
                <Icon size={13} />
                {column.label}
              </p>
              <span className="rounded-full bg-cu-bg px-2 py-0.5 text-xs font-bold text-cu-text-muted">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map((milestone) => (
                <MilestoneCard
                  key={milestone.id}
                  milestone={milestone}
                  selected={props.selectedId === milestone.id}
                  onSelect={props.onSelect}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onStatusChange={props.onStatusChange}
                />
              ))}
              {items.length === 0 && (
                <p className="rounded-cu-md border border-dashed border-cu-border bg-cu-bg px-3 py-6 text-center text-xs font-medium text-cu-text-muted">
                  No milestones here.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MilestoneList(props: {
  milestones: MilestoneViewModel[];
  selectedId?: number;
  onSelect: (milestone: MilestoneViewModel) => void;
  onEdit: (milestone: MilestoneViewModel) => void;
  onDelete: (milestone: MilestoneViewModel) => void;
  onStatusChange: (id: number, status: MilestoneStatus) => void;
}) {
  return (
    <div className="overflow-hidden rounded-cu-lg border border-cu-border bg-cu-bg shadow-cu-sm">
      <div className="grid grid-cols-[minmax(220px,1.5fr)_120px_140px_130px_120px] gap-3 border-b border-cu-border bg-cu-bg-secondary px-4 py-3 text-xs font-black uppercase text-cu-text-muted max-lg:hidden">
        <span>Milestone</span>
        <span>Health</span>
        <span>Due</span>
        <span>Progress</span>
        <span>Actions</span>
      </div>
      <div className="divide-y divide-cu-border">
        {props.milestones.map((milestone) => (
          <div
            key={milestone.id}
            className={`grid gap-3 px-4 py-3 transition-colors hover:bg-cu-hover lg:grid-cols-[minmax(220px,1.5fr)_120px_140px_130px_120px] lg:items-center ${
              props.selectedId === milestone.id ? 'bg-cu-primary/5' : ''
            }`}
          >
            <button type="button" onClick={() => props.onSelect(milestone)} className="min-w-0 text-left">
              <p className="truncate text-sm font-extrabold text-cu-text-primary">{milestone.name}</p>
              <p className="mt-0.5 line-clamp-1 text-xs font-medium text-cu-text-muted">
                {milestone.description || `${milestone.remainingTasks} tasks remaining`}
              </p>
            </button>
            <HealthPill health={milestone.health} />
            <span className={`text-xs font-bold ${milestone.isOverdue ? 'text-cu-danger' : 'text-cu-text-secondary'}`}>{formatDueLabel(milestone)}</span>
            <div>
              <div className="mb-1 flex justify-between text-xs font-bold text-cu-text-secondary">
                <span>{milestone.progress}%</span>
                <span>{milestone.completedTasks}/{milestone.linkedTasks}</span>
              </div>
              <MilestoneProgressBar progress={milestone.progress} />
            </div>
            <div className="flex items-center gap-2">
              <StatusSelect milestone={milestone} onChange={props.onStatusChange} />
              <button type="button" onClick={() => props.onEdit(milestone)} className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-cu-border text-cu-text-secondary hover:bg-cu-hover" aria-label={`Edit ${milestone.name}`}>
                <Edit2 size={14} />
              </button>
              <button type="button" onClick={() => props.onDelete(milestone)} className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-cu-border text-cu-danger hover:bg-cu-danger/10" aria-label={`Delete ${milestone.name}`}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneTimeline(props: {
  milestones: MilestoneViewModel[];
  selectedId?: number;
  onSelect: (milestone: MilestoneViewModel) => void;
  onEdit: (milestone: MilestoneViewModel) => void;
  onDelete: (milestone: MilestoneViewModel) => void;
  onStatusChange: (id: number, status: MilestoneStatus) => void;
}) {
  return (
    <div className="space-y-3">
      {props.milestones.map((milestone) => (
        <article key={milestone.id} className={`rounded-cu-lg border bg-cu-bg p-4 shadow-cu-sm ${props.selectedId === milestone.id ? 'border-cu-primary ring-2 ring-cu-primary/15' : 'border-cu-border'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <button type="button" onClick={() => props.onSelect(milestone)} className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-extrabold text-cu-text-primary">{milestone.name}</h3>
                <HealthPill health={milestone.health} />
              </div>
              <p className="mt-1 text-xs font-medium text-cu-text-muted">
                {compactDate(milestone.dueDate)} · {milestone.remainingTasks} remaining · {milestone.linkedTasks} linked tasks
              </p>
            </button>
            <div className="flex items-center gap-2">
              <StatusSelect milestone={milestone} onChange={props.onStatusChange} />
              <button type="button" onClick={() => props.onEdit(milestone)} className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-cu-border text-cu-text-secondary hover:bg-cu-hover" aria-label={`Edit ${milestone.name}`}>
                <Edit2 size={14} />
              </button>
              <button type="button" onClick={() => props.onDelete(milestone)} className="inline-flex h-9 w-9 items-center justify-center rounded-cu-md border border-cu-border text-cu-danger hover:bg-cu-danger/10" aria-label={`Delete ${milestone.name}`}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[88px_1fr_72px] items-center gap-3">
            <span className="text-xs font-bold text-cu-text-muted">{formatDueLabel(milestone)}</span>
            <MilestoneProgressBar progress={milestone.progress} />
            <span className="text-right text-xs font-black text-cu-text-primary">{milestone.progress}%</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function MilestoneDetailDrawer({
  projectId,
  milestone,
  onClose,
  onEdit,
  onDelete,
  onOpenTask,
  onRemoveTask,
}: {
  projectId: number;
  milestone: MilestoneViewModel | null;
  onClose: () => void;
  onEdit: (milestone: MilestoneViewModel) => void;
  onDelete: (milestone: MilestoneViewModel) => void;
  onOpenTask: (taskId: number) => void;
  onRemoveTask: (task: Task) => void;
}) {
  if (!milestone) return null;

  return (
    <aside className="fixed inset-0 z-40 flex justify-end bg-black/25 lg:bg-transparent" aria-label="Milestone details">
      <div className="flex h-full w-full max-w-[520px] flex-col border-l border-cu-border bg-cu-bg shadow-2xl">
        <div className="border-b border-cu-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-cu-primary" />
                <p className="text-xs font-black uppercase text-cu-text-muted">Milestone details</p>
              </div>
              <h2 className="mt-1 truncate text-xl font-black text-cu-text-primary">{milestone.name}</h2>
              <p className="mt-1 text-sm font-medium text-cu-text-secondary">{milestone.description || 'No description added.'}</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-cu-md text-cu-text-muted hover:bg-cu-hover" aria-label="Close milestone details">
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <HealthPill health={milestone.health} />
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CONFIG[milestone.status].badge} border-transparent`}>
              {getStatusLabel(milestone.status)}
            </span>
            <span className="rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-bold text-cu-text-secondary">
              {formatDueLabel(milestone)}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Progress', `${milestone.progress}%`],
              ['Linked', String(milestone.linkedTasks)],
              ['Remaining', String(milestone.remainingTasks)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-cu-md border border-cu-border bg-cu-bg-secondary px-3 py-2">
                <p className="text-[11px] font-black uppercase text-cu-text-muted">{label}</p>
                <p className="mt-1 text-lg font-black text-cu-text-primary">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <MilestoneProgressBar progress={milestone.progress} />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-cu-text-primary">Linked tasks</h3>
            <Link
              href={`/list?projectId=${projectId}&milestoneId=${milestone.id}`}
              className="text-xs font-bold text-cu-primary hover:underline"
            >
              Open list
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {milestone.linkedTaskItems.length > 0 ? (
              milestone.linkedTaskItems.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={onOpenTask} onRemove={onRemoveTask} />
              ))
            ) : (
              <p className="rounded-cu-md border border-dashed border-cu-border bg-cu-bg-secondary px-4 py-8 text-center text-sm font-medium text-cu-text-muted">
                No tasks are linked to this milestone yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cu-border px-5 py-4">
          <Link
            href={`/timeline/${projectId}`}
            className="inline-flex h-10 items-center justify-center rounded-cu-md border border-cu-border px-3 text-sm font-bold text-cu-text-primary hover:bg-cu-hover"
          >
            Open timeline
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(milestone)} className="inline-flex h-10 items-center gap-2 rounded-cu-md bg-cu-primary px-3 text-sm font-bold text-white hover:bg-cu-primary-hover">
              <Edit2 size={15} />
              Edit
            </button>
            <button type="button" onClick={() => onDelete(milestone)} className="inline-flex h-10 items-center gap-2 rounded-cu-md border border-cu-danger/30 px-3 text-sm font-bold text-cu-danger hover:bg-cu-danger/10">
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MilestoneFormModal({
  milestone,
  onSubmit,
  onClose,
}: {
  milestone: MilestoneResponse | null;
  onSubmit: (data: MilestoneFormData) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl">
        <MilestoneForm initial={milestone ?? undefined} onSubmit={onSubmit} onCancel={onClose} />
      </div>
    </div>
  );
}

function DeleteMilestoneModal({
  milestone,
  onCancel,
  onConfirm,
}: {
  milestone: MilestoneViewModel;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-cu-lg border border-cu-border bg-cu-bg p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-cu-md bg-cu-danger/10 text-cu-danger">
            <Trash2 size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-cu-text-primary">Delete milestone?</h2>
            <p className="mt-1 text-sm font-medium text-cu-text-secondary">
              {milestone.name} will be deleted. Linked tasks will stay in the project.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-cu-md border border-cu-border px-4 text-sm font-bold text-cu-text-primary hover:bg-cu-hover">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-cu-md bg-cu-danger px-4 text-sm font-bold text-white hover:opacity-90">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestonesPageContent() {
  const searchParams = useSearchParams();
  const projectIdStr = searchParams.get('projectId');
  const projectId = projectIdStr ? Number(projectIdStr) : null;
  const cacheKey = projectId ? `planora:milestones:${projectId}:workspace` : null;

  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MilestoneFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<MilestoneView>('board');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<MilestoneResponse | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<MilestoneViewModel | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!projectId || !cacheKey) return;
    if (!options?.silent) setLoading(true);
    setRefreshing(Boolean(options?.silent));
    setError(null);

    const cached = localStorage.getItem(cacheKey);
    if (cached && !options?.silent) {
      try {
        const parsed = JSON.parse(cached) as { milestones: MilestoneResponse[]; tasks: Task[] };
        setMilestones(parsed.milestones ?? []);
        setTasks(parsed.tasks ?? []);
        setLoading(false);
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      const [milestoneData, taskData] = await Promise.all([
        getMilestones(projectId),
        tasksApi.listAllByProject(projectId, { archived: false }),
      ]);
      setMilestones(milestoneData);
      setTasks(taskData);
      localStorage.setItem(cacheKey, JSON.stringify({ milestones: milestoneData, tasks: taskData }));
    } catch {
      if (!cached) setError('Failed to load milestone planning data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId, cacheKey]);

  useEffect(() => {
    queueMicrotask(() => void loadData());
  }, [loadData]);

  useEffect(() => {
    const refresh = () => void loadData({ silent: true });
    window.addEventListener('planora:task-updated', refresh);
    window.addEventListener('planora:milestone-updated', refresh);
    return () => {
      window.removeEventListener('planora:task-updated', refresh);
      window.removeEventListener('planora:milestone-updated', refresh);
    };
  }, [loadData]);

  const viewModels = useMemo(() => buildMilestoneViewModels(milestones, tasks), [milestones, tasks]);
  const visibleMilestones = useMemo(
    () => sortMilestones(filterMilestones(viewModels, filters), filters.sort),
    [viewModels, filters],
  );
  const stats = useMemo(() => getMilestoneStats(viewModels), [viewModels]);
  const selectedMilestone = useMemo(
    () => viewModels.find((milestone) => milestone.id === selectedId) ?? null,
    [viewModels, selectedId],
  );

  const patchCache = useCallback((nextMilestones: MilestoneResponse[], nextTasks = tasks) => {
    if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ milestones: nextMilestones, tasks: nextTasks }));
  }, [cacheKey, tasks]);

  const handleCreate = useCallback(async (data: MilestoneFormData) => {
    if (!projectId) return;
    try {
      const created = await createMilestone(projectId, {
        name: data.name,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        status: data.status,
      });
      setMilestones((prev) => {
        const next = [created, ...prev];
        patchCache(next);
        return next;
      });
      setShowCreate(false);
      setSelectedId(created.id);
      dispatchMilestoneUpdated();
    } catch {
      setError('Failed to create milestone');
    }
  }, [projectId, patchCache]);

  const handleUpdate = useCallback(async (data: MilestoneFormData) => {
    if (!editing) return;
    try {
      const updated = await updateMilestone(editing.id, {
        name: data.name,
        description: data.description || undefined,
        dueDate: data.dueDate || undefined,
        status: data.status,
      });
      setMilestones((prev) => {
        const next = prev.map((milestone) => milestone.id === updated.id ? updated : milestone);
        patchCache(next);
        return next;
      });
      setEditing(null);
      setSelectedId(updated.id);
      dispatchMilestoneUpdated();
    } catch {
      setError('Failed to update milestone');
    }
  }, [editing, patchCache]);

  const handleStatusChange = useCallback(async (id: number, status: MilestoneStatus) => {
    const current = milestones.find((milestone) => milestone.id === id);
    if (!current || current.status === status) return;
    setMilestones((prev) => prev.map((milestone) => milestone.id === id ? { ...milestone, status } : milestone));
    try {
      const updated = await updateMilestone(id, {
        name: current.name,
        description: current.description,
        dueDate: current.dueDate,
        status,
      });
      setMilestones((prev) => {
        const next = prev.map((milestone) => milestone.id === id ? updated : milestone);
        patchCache(next);
        return next;
      });
      dispatchMilestoneUpdated();
    } catch {
      setMilestones((prev) => prev.map((milestone) => milestone.id === id ? current : milestone));
      setError('Failed to update milestone status');
      void loadData({ silent: true });
    }
  }, [milestones, patchCache, loadData]);

  const handleDelete = useCallback(async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    setMilestones((prev) => {
      const next = prev.filter((milestone) => milestone.id !== target.id);
      patchCache(next);
      return next;
    });
    if (selectedId === target.id) setSelectedId(null);
    try {
      await deleteMilestone(target.id);
      dispatchMilestoneUpdated();
    } catch {
      setError('Failed to delete milestone');
      void loadData({ silent: true });
    }
  }, [deleting, patchCache, selectedId, loadData]);

  const handleRemoveTask = useCallback(async (task: Task) => {
    const previousTasks = tasks;
    const nextTasks = tasks.map((item) => item.id === task.id ? { ...item, milestoneId: undefined, milestoneName: undefined } : item);
    setTasks(nextTasks);
    if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ milestones, tasks: nextTasks }));
    try {
      await assignTaskToMilestone(task.id, null);
      window.dispatchEvent(new CustomEvent('planora:task-updated', { detail: { taskId: task.id } }));
    } catch {
      setTasks(previousTasks);
      setError('Failed to remove task from milestone');
    }
  }, [tasks, milestones, cacheKey]);

  if (!projectId) {
    return (
      <div className="min-h-screen bg-cu-bg-secondary">
        <EmptyState
          icon={<Flag size={24} />}
          title="Select a project to view milestones"
          subtitle="Choose a project from your dashboard to plan releases, deadlines, and linked work."
          action={(
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-cu-md bg-cu-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-cu-primary-hover">
              Go to Dashboard
            </Link>
          )}
          className="min-h-[60vh]"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-cu-bg-secondary">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="sticky top-0 z-20 mb-4 rounded-cu-lg border border-cu-border bg-cu-bg/95 px-4 py-4 shadow-cu-sm backdrop-blur sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-cu-md bg-cu-primary text-white shadow-cu-sm">
                  <Flag size={18} />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black tracking-tight text-cu-text-primary">Milestones</h1>
                  <p className="mt-0.5 text-sm font-medium text-cu-text-secondary">
                    {visibleMilestones.length} visible of {stats.total} milestones · {stats.completedTasks}/{stats.linkedTasks} linked tasks complete
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/timeline/${projectId}`} className="inline-flex h-10 items-center gap-2 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-primary hover:bg-cu-hover">
                <CalendarClock size={15} />
                Timeline
              </Link>
              <button type="button" onClick={() => void loadData({ silent: true })} className="inline-flex h-10 items-center gap-2 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-primary hover:bg-cu-hover">
                {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Refresh
              </button>
              <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-10 items-center gap-2 rounded-cu-md bg-cu-primary px-3 text-sm font-bold text-white hover:bg-cu-primary-hover">
                <Plus size={15} />
                New milestone
              </button>
            </div>
          </div>
        </header>

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Active', value: stats.active, icon: Layers3, tone: 'text-cu-primary' },
            { label: 'Overdue', value: stats.overdue, icon: AlertCircle, tone: 'text-cu-danger' },
            { label: 'Due soon', value: stats.dueSoon, icon: Clock3, tone: 'text-cu-warning' },
            { label: 'Linked tasks', value: stats.linkedTasks, icon: ListChecks, tone: 'text-cu-text-primary' },
            { label: 'Completed', value: stats.completedTasks, icon: CheckCircle2, tone: 'text-cu-success' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-cu-lg border border-cu-border bg-cu-bg px-4 py-3 shadow-cu-sm">
                <p className="flex items-center gap-2 text-xs font-black uppercase text-cu-text-muted">
                  <Icon size={13} className={item.tone} />
                  {item.label}
                </p>
                <p className={`mt-1 text-2xl font-black ${item.tone}`}>{item.value}</p>
              </div>
            );
          })}
        </section>

        <section className="mb-4 rounded-cu-lg border border-cu-border bg-cu-bg p-3 shadow-cu-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Search milestones"
                className="h-10 w-full rounded-cu-md border border-cu-border bg-cu-bg-secondary pl-9 pr-3 text-sm font-medium text-cu-text-primary outline-none transition-colors focus:border-cu-primary"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as MilestoneFilters['status'] }))} className="h-10 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-primary">
                <option value="ALL">All statuses</option>
                {(Object.keys(STATUS_CONFIG) as MilestoneStatus[]).map((status) => (
                  <option key={status} value={status}>{getStatusLabel(status)}</option>
                ))}
              </select>
              <select value={filters.due} onChange={(event) => setFilters((prev) => ({ ...prev, due: event.target.value as MilestoneDueBucket }))} className="h-10 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-primary">
                <option value="all">All dates</option>
                <option value="overdue">Overdue</option>
                <option value="this-week">Due this week</option>
                <option value="later">Later</option>
                <option value="no-date">No due date</option>
              </select>
              <select value={filters.sort} onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value as MilestoneSort }))} className="h-10 rounded-cu-md border border-cu-border bg-cu-bg px-3 text-sm font-bold text-cu-text-primary">
                <option value="dueDate">Sort by due date</option>
                <option value="progress">Sort by progress</option>
                <option value="taskCount">Sort by task count</option>
                <option value="name">Sort by name</option>
                <option value="updatedAt">Sort by recently updated</option>
              </select>
              <div className="grid grid-cols-3 rounded-cu-md border border-cu-border bg-cu-bg-secondary p-1">
                {[
                  ['board', Kanban, 'Board'],
                  ['timeline', BarChart3, 'Timeline'],
                  ['list', ListChecks, 'List'],
                ].map(([value, Icon, label]) => {
                  const Component = Icon as typeof Flag;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setView(value as MilestoneView)}
                      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-cu-md px-2 text-xs font-black transition-colors ${
                        view === value ? 'bg-cu-bg text-cu-primary shadow-cu-sm' : 'text-cu-text-secondary hover:text-cu-text-primary'
                      }`}
                    >
                      <Component size={13} />
                      <span className="hidden sm:inline">{String(label)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-cu-lg border border-cu-danger/25 bg-cu-danger/10 px-4 py-3 text-sm font-bold text-cu-danger">
            <span className="inline-flex items-center gap-2"><AlertCircle size={15} /> {error}</span>
            <button type="button" onClick={() => void loadData()} className="inline-flex h-8 items-center gap-2 rounded-cu-md bg-cu-bg px-3 text-xs font-bold text-cu-danger">
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-cu-lg border border-cu-border bg-cu-bg">
            <Loader2 size={28} className="animate-spin text-cu-primary" />
          </div>
        ) : viewModels.length === 0 ? (
          <EmptyState
            icon={<Flag size={26} />}
            title="No milestones yet"
            subtitle="Create a milestone to track launch goals, deadlines, and linked project work."
            action={(
              <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-cu-md bg-cu-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-cu-primary-hover">
                <Plus size={14} />
                New milestone
              </button>
            )}
          />
        ) : visibleMilestones.length === 0 ? (
          <EmptyState
            icon={<Search size={26} />}
            title="No milestones match these filters"
            subtitle="Clear or adjust the filters to see more planning work."
            action={(
              <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="rounded-cu-md border border-cu-border bg-cu-bg px-4 py-2.5 text-sm font-bold text-cu-text-primary hover:bg-cu-hover">
                Clear filters
              </button>
            )}
          />
        ) : view === 'board' ? (
          <MilestoneBoard
            milestones={visibleMilestones}
            selectedId={selectedId ?? undefined}
            onSelect={(milestone) => setSelectedId(milestone.id)}
            onEdit={setEditing}
            onDelete={setDeleting}
            onStatusChange={handleStatusChange}
          />
        ) : view === 'timeline' ? (
          <MilestoneTimeline
            milestones={visibleMilestones}
            selectedId={selectedId ?? undefined}
            onSelect={(milestone) => setSelectedId(milestone.id)}
            onEdit={setEditing}
            onDelete={setDeleting}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <MilestoneList
            milestones={visibleMilestones}
            selectedId={selectedId ?? undefined}
            onSelect={(milestone) => setSelectedId(milestone.id)}
            onEdit={setEditing}
            onDelete={setDeleting}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      <MilestoneDetailDrawer
        projectId={projectId}
        milestone={selectedMilestone}
        onClose={() => setSelectedId(null)}
        onEdit={setEditing}
        onDelete={setDeleting}
        onOpenTask={setSelectedTaskId}
        onRemoveTask={handleRemoveTask}
      />

      {showCreate && (
        <MilestoneFormModal milestone={null} onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <MilestoneFormModal milestone={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <DeleteMilestoneModal milestone={deleting} onCancel={() => setDeleting(null)} onConfirm={handleDelete} />
      )}
      {selectedTaskId != null && (
        <TaskCardModal
          taskId={selectedTaskId}
          onClose={(modified) => {
            setSelectedTaskId(null);
            if (modified) {
              window.dispatchEvent(new CustomEvent('planora:task-updated', { detail: { taskId: selectedTaskId } }));
              void loadData({ silent: true });
            }
          }}
        />
      )}
    </div>
  );
}

export default function MilestonesPage() {
  return (
    <Suspense fallback={<RouteLoadingState title="Loading milestones" subtitle="Preparing project milestones." variant="cards" />}>
      <MilestonesPageContent />
    </Suspense>
  );
}
