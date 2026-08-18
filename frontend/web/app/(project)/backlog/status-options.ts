import type { KanbanColumnConfig } from '../kanban/types';

export interface BacklogStatusOption {
    status: string;
    title: string;
}

export const DEFAULT_BACKLOG_STATUS_OPTIONS: BacklogStatusOption[] = [
    { status: 'TODO', title: 'To Do' },
    { status: 'IN_PROGRESS', title: 'In Progress' },
    { status: 'IN_REVIEW', title: 'In Review' },
    { status: 'DONE', title: 'Done' },
];

export function formatStatusLabel(status: string): string {
    return status.replace(/_/g, ' ');
}

export function statusOptionsFromColumns(
    columns?: readonly Pick<KanbanColumnConfig, 'status' | 'title'>[] | null,
): BacklogStatusOption[] {
    if (!columns?.length) return DEFAULT_BACKLOG_STATUS_OPTIONS;

    const options = columns
        .filter(column => column.status)
        .map(column => ({
            status: column.status,
            title: column.title || formatStatusLabel(column.status),
        }));

    return options.length > 0 ? options : DEFAULT_BACKLOG_STATUS_OPTIONS;
}

export function normalizeBacklogStatusOptions(
    options?: readonly BacklogStatusOption[],
    currentStatus?: string | null,
): BacklogStatusOption[] {
    const normalized = options?.length ? [...options] : [...DEFAULT_BACKLOG_STATUS_OPTIONS];
    if (!currentStatus) return normalized;

    const seen = new Set(normalized.map(option => option.status));
    if (!seen.has(currentStatus)) {
        normalized.push({ status: currentStatus, title: formatStatusLabel(currentStatus) });
    }

    return normalized;
}
