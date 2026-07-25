import { useState, useCallback, useEffect, useMemo } from 'react';
import { Task, Label, DateFilter } from '../../kanban/types';
import {
    fetchProjectLabels,
    fetchProject,
    fetchTeamMembers,
    TeamMemberOption,
} from '../../kanban/api';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { toast } from '@/components/ui';
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
    const activeTaskSource = useProjectTasks(projectId, false);
    const archivedTaskSource = useProjectTasks(showArchived ? projectId : null, true);

    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

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

    const enrichTaskAvatars = useCallback((items: readonly Task[]): Task[] => {
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

    const tasks = useMemo(
        () => enrichTaskAvatars(activeTaskSource.tasks as unknown as Task[]),
        [activeTaskSource.tasks, enrichTaskAvatars],
    );
    const archivedTasks = useMemo(
        () => showArchived
            ? enrichTaskAvatars(archivedTaskSource.tasks as unknown as Task[])
            : [],
        [archivedTaskSource.tasks, enrichTaskAvatars, showArchived],
    );
    const forceRefresh = useCallback(async () => {
        await Promise.all([
            activeTaskSource.revalidate(),
            showArchived ? archivedTaskSource.revalidate() : Promise.resolve(),
        ]);
    }, [activeTaskSource, archivedTaskSource, showArchived]);

    useEffect(() => {
        if (!projectId) return;
        queueMicrotask(() => void fetchStaticData());
    }, [projectId, fetchStaticData]);

    // The subscriber updates the canonical SWR cache. This UI renders that cache
    // directly and must not apply the same event to a second local task array.
    useTaskWebSocket(projectId, useCallback(() => undefined, []));

    const handleMarkDone = useCallback(async (id: number) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        try {
            await taskMutations.update(id, { title: task.title, status: 'DONE' }, task as unknown as CanonicalTask);
        } catch {
            void forceRefresh();
        }
    }, [tasks, forceRefresh, taskMutations]);

    const handleDelete = useCallback(async (id: number) => {
        const task = tasks.find(item => item.id === id);
        if (!task) return;
        try { await taskMutations.delete(task as unknown as CanonicalTask); } catch { void forceRefresh(); }
    }, [forceRefresh, taskMutations, tasks]);

    const handleAddTask = useCallback((data: CreateTaskData) => {
        if (!projectId) return;
        taskMutations.create({
                projectId: parseInt(projectId, 10),
                title: data.title,
                priority: normalizeTaskPriority(data.priority),
                assigneeId: data.assigneeId,
                labelIds: data.labelIds,
                dueDate: data.dueDate,
            });
    }, [projectId, taskMutations]);

    const handleStatusChange = useCallback(async (id: number, status: string) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        try {
            await taskMutations.update(id, { title: task.title, status }, task as unknown as CanonicalTask);
        } catch {
            void forceRefresh();
        }
    }, [tasks, forceRefresh, taskMutations]);

    const handleDateChange = useCallback(async (id: number, dueDate: string | null) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        try {
            await taskMutations.update(
                id,
                { title: task.title, dueDate },
                task as unknown as CanonicalTask,
            );
        } catch {
            void forceRefresh();
        }
    }, [tasks, forceRefresh, taskMutations]);

    const handleArchiveTask = useCallback(async (id: number) => {
        const archivedTask = tasks.find(t => t.id === id);
        if (!archivedTask) return;
        try {
            await taskMutations.archive(archivedTask as unknown as CanonicalTask);
        } catch {
            toast('Failed to archive task', 'error');
            void forceRefresh();
        }
    }, [tasks, forceRefresh, taskMutations]);

    const handleUnarchiveTask = useCallback(async (id: number) => {
        const task = archivedTasks.find(t => t.id === id);
        if (!task) return;
        try {
            await taskMutations.restore(task as unknown as CanonicalTask);
        } catch {
            toast('Failed to unarchive task', 'error');
            void forceRefresh();
        }
    }, [archivedTasks, forceRefresh, taskMutations]);

    const handleBulkDelete = useCallback(async () => {
        const ids = [...selectedIds];
        setSelectedIds(new Set());
        const selectedTasks = tasks.filter(task => ids.includes(task.id));
        try {
            await Promise.all(selectedTasks.map(task =>
                taskMutations.delete(task as unknown as CanonicalTask)));
        } catch {
            void forceRefresh();
        }
    }, [selectedIds, forceRefresh, taskMutations, tasks]);

    const handleBulkDone = useCallback(async () => {
        const ids = [...selectedIds];
        setSelectedIds(new Set());
        const tasksToUpdate = tasks.filter(task => ids.includes(task.id));
        try {
            await Promise.all(tasksToUpdate.map(task =>
                taskMutations.update(
                    task.id,
                    { title: task.title, status: 'DONE' },
                    task as unknown as CanonicalTask,
                )));
        } catch {
            void forceRefresh();
        }
    }, [tasks, selectedIds, forceRefresh, taskMutations]);

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
        tasks, archivedTasks,
        archivedLoading: archivedTaskSource.loading,
        loading: activeTaskSource.loading,
        error: activeTaskSource.error instanceof Error ? activeTaskSource.error.message : activeTaskSource.error ? 'Failed to load tasks' : null,
        collapsedGroups, toggleGroup,
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
        toggleSelect, loadTasks: forceRefresh, handleDateChange, forceRefresh,
    };
}
