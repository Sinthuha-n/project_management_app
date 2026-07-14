import { useState, useCallback, useEffect, useMemo } from 'react';
import { Task, Label, DateFilter } from '../../kanban/types';
import {
    fetchTasksByProject,
    fetchProjectLabels,
    fetchProject,
    fetchTeamMembers,
    getArchivedTasks,
    TeamMemberOption,
} from '../../kanban/api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { buildSessionCacheKey, getSessionCache, setSessionCache, removeSessionCache } from '@/lib/session-cache';
import { toast } from '@/components/ui';
import { tasksApi } from '@/services/api-contract';
import { normalizeTaskPriority } from '@/services/tasks-contract';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import type { Task as CanonicalTask } from '@/types';

type TaskWithAssignees = Task & {
    assignees?: Array<{ id?: number; avatar?: string | null }>;
};

export function useBacklogData(projectId: string | null, showArchived = false) {
    const taskMutations = useTaskMutations(projectId);
    const canonicalTasks = useProjectTasks(projectId, showArchived);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (!canonicalTasks.authoritative) return;
        setTasks(canonicalTasks.tasks as unknown as Task[]);
    }, [canonicalTasks.authoritative, canonicalTasks.tasks]);

    // Filter & group state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterLabel, setFilterLabel] = useState<number | null>(null);
    const [filterDateRange, setFilterDateRange] = useState<DateFilter>({ startDate: null, endDate: null });
    const [groupBy, setGroupBy] = useState<'none' | 'status' | 'priority' | 'assignee'>('none');

    const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
    const [labels, setLabels] = useState<Label[]>([]);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = useCallback((label: string) => {
        setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    }, []);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // ── Static Data (Run once per project) ──
    const fetchStaticData = useCallback(async () => {
        if (!projectId) return;
        const pid = parseInt(projectId, 10);
        if (isNaN(pid)) return;
        try {
            const [labelsData, project] = await Promise.all([
                fetchProjectLabels(pid),
                fetchProject(pid),
            ]);
            setLabels(labelsData);
            if (project?.teamId) {
                const members = await fetchTeamMembers(project.teamId as number);
                setTeamMembers(members);
            }
        } catch (err) {
            console.error('Error loading static backlog data:', err);
        }
    }, [projectId]);

    const memberPhotoById = useMemo(() => {
        const map: Record<number, string | null> = {};
        teamMembers.forEach((member) => {
            map[member.id] = member.photoUrl ?? null;
            if (member.userId != null) {
                map[member.userId] = member.photoUrl ?? null;
            }
        });
        return map;
    }, [teamMembers]);

    const enrichTaskAvatars = useCallback((items: Task[]): Task[] => {
        return items.map((task) => {
            const taskWithAssignees = task as TaskWithAssignees;
            const assigneePhotoUrl =
                resolveProfilePhotoUrl(task.assigneePhotoUrl, task.assigneeId) ||
                (task.assigneeId != null ? memberPhotoById[task.assigneeId] : null) ||
                null;

            const assignees = taskWithAssignees.assignees?.map((assignee) => ({
                ...assignee,
                avatar: resolveProfilePhotoUrl(assignee.avatar, assignee.id) || assignee.avatar,
            }));

            return {
                ...task,
                assigneePhotoUrl,
                ...(assignees ? { assignees } : {}),
            };
        });
    }, [memberPhotoById]);

    // ── Dynamic Data (Periodic Sync) ──
    const fetchData = useCallback(async (options: { showSpinner?: boolean, forceNetwork?: boolean } = {}) => {
        if (!projectId) return;
        const { showSpinner = true, forceNetwork = false } = options;
        const pid = parseInt(projectId, 10);
        if (isNaN(pid)) return;

        const cKey = buildSessionCacheKey('kanban-backlog', [projectId, showArchived.toString()]);
        let hasCachedData = false;
        if (cKey && !forceNetwork) {
            const cached = getSessionCache<Task[]>(cKey, { allowStale: true });
            if (cached.data) {
                setTasks(cached.data);
                setLoading(false);
                hasCachedData = true;
            }
        }

        if (showSpinner && !hasCachedData) setLoading(true);
        setError(null);
        try {
            const fetched = await fetchTasksByProject(pid, { archived: showArchived });
            const enriched = enrichTaskAvatars(fetched);
            setTasks(enriched);
            if (cKey) setSessionCache(cKey, enriched, 30 * 60_000);
        } catch (err) {
            console.error('Error loading backlog tasks:', err);
            if (showSpinner) setError(err instanceof Error ? err.message : 'Failed to load tasks');
        } finally {
            if (showSpinner && !hasCachedData) setLoading(false);
        }
    }, [projectId, showArchived, enrichTaskAvatars]);

    const fetchArchivedData = useCallback(async () => {
        if (!projectId || !showArchived) {
            setArchivedTasks([]);
            setArchivedLoading(false);
            return;
        }
        const pid = parseInt(projectId, 10);
        if (isNaN(pid)) {
            setArchivedLoading(false);
            return;
        }
        setArchivedLoading(true);
        try {
            const data = await getArchivedTasks(pid);
            setArchivedTasks(enrichTaskAvatars(data as Task[]));
        } catch (err) {
            console.error('Error loading archived backlog tasks:', err);
            toast('Failed to load archived tasks', 'error');
        } finally {
            setArchivedLoading(false);
        }
    }, [projectId, showArchived, enrichTaskAvatars]);

    const forceRefresh = useCallback(() => void fetchData({ showSpinner: false, forceNetwork: true }), [fetchData]);

    useEffect(() => {
        if (!projectId) return;
        void fetchStaticData();
        void fetchData({ showSpinner: true });
        const id = setInterval(() => void fetchData({ showSpinner: false }), 30_000);
        return () => clearInterval(id);
    }, [projectId, fetchStaticData, fetchData]);

    useEffect(() => {
        void fetchArchivedData();
    }, [fetchArchivedData]);

    useEffect(() => {
        const onTaskUpdated = () => void fetchData({ showSpinner: false, forceNetwork: true });
        window.addEventListener('planora:task-updated', onTaskUpdated);
        return () => window.removeEventListener('planora:task-updated', onTaskUpdated);
    }, [fetchData]);

    useTaskWebSocket(projectId, useCallback((event) => {
        if (event.type === 'TASK_CREATED' && event.task) {
            if (!event.task.archived) {
                setTasks(prev => enrichTaskAvatars([...prev.filter(x => x.id !== event.task!.id), event.task as Task]));
            }
        } else if (event.type === 'TASK_UPDATED' && event.task) {
            if (event.task.archived) {
                setTasks(prev => prev.filter(x => x.id !== event.task!.id));
                if (showArchived) {
                    setArchivedTasks(prev => [...prev.filter(x => x.id !== event.task!.id), event.task as Task]);
                }
            } else {
                setTasks(prev => prev.some(x => x.id === event.task!.id)
                    ? enrichTaskAvatars(prev.map(x => x.id === event.task!.id ? { ...x, ...event.task } as Task : x))
                    : enrichTaskAvatars([...prev, event.task as Task]));
                setArchivedTasks(prev => prev.filter(x => x.id !== event.task!.id));
            }
        } else if (event.type === 'TASK_DELETED' && event.taskId) {
            setTasks(prev => prev.filter(x => x.id !== event.taskId));
            setArchivedTasks(prev => prev.filter(x => x.id !== event.taskId));
        }
    }, [showArchived, enrichTaskAvatars]));

    const handleMarkDone = useCallback(async (id: number) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'DONE' } : t));
        try {
            await taskMutations.update(id, { title: task.title, status: 'DONE' }, task as unknown as CanonicalTask);
        } catch {
            forceRefresh();
        }
    }, [tasks, forceRefresh, taskMutations]);

    const handleDelete = useCallback(async (id: number) => {
        const task = tasks.find(item => item.id === id);
        if (!task) return;
        setTasks(prev => prev.filter(t => t.id !== id));
        try { await taskMutations.delete(task as unknown as CanonicalTask); } catch { forceRefresh(); }
    }, [forceRefresh, taskMutations, tasks]);

    const handleAddTask = useCallback((data: CreateTaskData) => {
        if (!projectId) return;
        const result = taskMutations.create({
                projectId: parseInt(projectId, 10),
                title: data.title,
                priority: normalizeTaskPriority(data.priority),
                assigneeId: data.assigneeId,
                labelIds: data.labelIds,
                dueDate: data.dueDate,
            });
        setTasks(prev => [...prev, result.optimisticTask]);
        void result.completion.then((serverTask) => {
            setTasks(prev => prev
                .filter(task => task.id !== serverTask.id)
                .map(task => task.id === result.optimisticTask.id ? serverTask as Task : task));
        }).catch(() => setTasks(prev => prev.filter(task => task.id !== result.optimisticTask.id)));
    }, [projectId, taskMutations]);

    const handleStatusChange = useCallback(async (id: number, status: string) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        try {
            await taskMutations.update(id, { title: task.title, status }, task as unknown as CanonicalTask);
        } catch {
            forceRefresh();
        }
    }, [tasks, forceRefresh, taskMutations]);

    const handleDateChange = useCallback(async (id: number, dueDate: string | null) => {
        const task = tasks.find(t => t.id === id);
        setTasks(prev => prev.map(t => t.id === id ? { ...t, dueDate: dueDate || undefined } : t));
        try {
            await tasksApi.updateDates(id, { dueDate });
            const cKey = buildSessionCacheKey('kanban-backlog', [projectId]);
            if (cKey) removeSessionCache(cKey);
            window.dispatchEvent(new CustomEvent('planora:task-updated'));
        } catch (e: unknown) {
            const errStatus = (e as { response?: { status?: number } })?.response?.status;
            if ((errStatus === 401 || errStatus === 404) && task?.title) {
                try {
                    await tasksApi.update(id, { title: task.title, dueDate });
                    const cKey = buildSessionCacheKey('kanban-backlog', [projectId]);
                    if (cKey) removeSessionCache(cKey);
                    window.dispatchEvent(new CustomEvent('planora:task-updated'));
                    return;
                } catch { /* fall through */ }
            }
            forceRefresh();
        }
    }, [tasks, projectId, forceRefresh]);

    const handleArchiveTask = useCallback(async (id: number) => {
        const archivedTask = tasks.find(t => t.id === id);
        if (!archivedTask) return;
        setTasks(prev => prev.filter(t => t.id !== id));
        try {
            const res = await taskMutations.archive(archivedTask as unknown as CanonicalTask);
            if (showArchived) {
                setArchivedTasks(prev => [...prev.filter(t => t.id !== id), res as Task]);
            }
            forceRefresh();
            void fetchArchivedData();
        } catch {
            if (archivedTask) setTasks(prev => prev.some(t => t.id === id) ? prev : [...prev, archivedTask]);
            toast('Failed to archive task', 'error');
            forceRefresh();
        }
    }, [tasks, showArchived, forceRefresh, fetchArchivedData, taskMutations]);

    const handleUnarchiveTask = useCallback(async (id: number) => {
        const task = archivedTasks.find(t => t.id === id);
        if (!task) return;
        setArchivedTasks(prev => prev.filter(t => t.id !== id));
        try {
            const res = await taskMutations.restore(task as unknown as CanonicalTask);
            setTasks(prev => prev.some(t => t.id === id) ? prev : [...prev, res as Task]);
            forceRefresh();
            void fetchArchivedData();
        } catch {
            if (task) setArchivedTasks(prev => prev.some(t => t.id === id) ? prev : [...prev, task]);
            toast('Failed to unarchive task', 'error');
            forceRefresh();
        }
    }, [archivedTasks, forceRefresh, fetchArchivedData, taskMutations]);

    const handleBulkDelete = useCallback(async () => {
        const ids = [...selectedIds];
        setTasks(prev => prev.filter(t => !ids.includes(t.id)));
        setSelectedIds(new Set());
        try { await Promise.all(ids.map(id => tasksApi.delete(id))); forceRefresh(); } catch { forceRefresh(); }
    }, [selectedIds, forceRefresh]);

    const handleBulkDone = useCallback(async () => {
        const ids = [...selectedIds];
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'DONE' } : t));
        setSelectedIds(new Set());
        try {
            await tasksApi.bulkUpdateStatus({ taskIds: ids, status: 'DONE' });
            forceRefresh();
        } catch {
            // Fallback: update each task individually with PUT
            try {
                const tasksToUpdate = tasks.filter(t => ids.includes(t.id));
                await Promise.all(tasksToUpdate.map(t => tasksApi.update(t.id, { title: t.title, status: 'DONE' })));
                forceRefresh();
            } catch { forceRefresh(); }
        }
    }, [tasks, selectedIds, forceRefresh]);

    const toggleSelect = useCallback((id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    // Filtered + grouped tasks
    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(lower));
        }
        if (filterPriority.length > 0) result = result.filter(t => t.priority && filterPriority.includes(t.priority));
        if (filterStatus.length > 0) result = result.filter(t => filterStatus.includes(t.status));
        if (filterAssignee) result = result.filter(t => t.assigneeName === filterAssignee);
        if (filterLabel !== null) result = result.filter(t => t.labels?.some(l => l.id === filterLabel) || t.labelId === filterLabel);
        if (filterDateRange.startDate || filterDateRange.endDate) {
            result = result.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate + 'T00:00:00');
                if (filterDateRange.startDate && d < filterDateRange.startDate) return false;
                if (filterDateRange.endDate && d > filterDateRange.endDate) return false;
                return true;
            });
        }
        return result;
    }, [tasks, searchTerm, filterPriority, filterStatus, filterAssignee, filterLabel, filterDateRange]);

    const groupedTasks = useMemo(() => {
        if (groupBy === 'none') return [{ label: 'Backlog', items: filteredTasks }];
        if (groupBy === 'status') {
            const groups: Record<string, Task[]> = {};
            filteredTasks.forEach(t => { (groups[t.status] = groups[t.status] || []).push(t); });
            return Object.entries(groups).map(([label, items]) => ({ label: label.replace(/_/g, ' '), items }));
        }
        if (groupBy === 'assignee') {
            const groups: Record<string, Task[]> = {};
            filteredTasks.forEach(t => { const k = t.assigneeName || 'Unassigned'; (groups[k] = groups[k] || []).push(t); });
            return Object.entries(groups).map(([label, items]) => ({ label, items }));
        }
        const groups: Record<string, Task[]> = {};
        filteredTasks.forEach(t => { const k = t.priority || 'NONE'; (groups[k] = groups[k] || []).push(t); });
        return Object.entries(groups).map(([label, items]) => ({ label, items }));
    }, [filteredTasks, groupBy]);

    return {
        tasks, archivedTasks, archivedLoading, loading, error, collapsedGroups, toggleGroup,
        selectedTask, setSelectedTask,
        selectedTaskIdForModal, setSelectedTaskIdForModal,
        showCreateModal, setShowCreateModal,
        searchTerm, setSearchTerm,
        filterPriority, setFilterPriority,
        filterStatus, setFilterStatus,
        filterAssignee, setFilterAssignee,
        filterLabel, setFilterLabel,
        filterDateRange, setFilterDateRange,
        groupBy, setGroupBy,
        teamMembers, labels,
        selectedIds, setSelectedIds,
        filteredTasks, groupedTasks,
        handleMarkDone, handleDelete, handleAddTask,
        handleStatusChange, handleBulkDelete, handleBulkDone,
        handleArchiveTask, handleUnarchiveTask,
        toggleSelect, loadTasks: fetchData, handleDateChange, forceRefresh,
    };
}
