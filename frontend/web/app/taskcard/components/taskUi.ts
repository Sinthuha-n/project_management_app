'use client';

import type { CSSProperties } from 'react';

export interface TaskLabelChip {
  id?: number;
  name: string;
  color?: string | null;
}

export interface TaskPersonChip {
  name: string;
  photoUrl?: string | null;
}

export const PRIORITY_STYLES: Record<string, { text: string; bg: string; dot: string; rail: string; label: string }> = {
  URGENT: { text: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500', rail: 'border-l-red-500', label: 'Urgent' },
  HIGH: { text: 'text-orange-500', bg: 'bg-orange-500/10', dot: 'bg-orange-500', rail: 'border-l-orange-500', label: 'High' },
  MEDIUM: { text: 'text-amber-500', bg: 'bg-amber-500/10', dot: 'bg-amber-400', rail: 'border-l-amber-400', label: 'Medium' },
  NORMAL: { text: 'text-cu-primary', bg: 'bg-cu-primary/10', dot: 'bg-cu-primary', rail: 'border-l-cu-primary', label: 'Normal' },
  LOW: { text: 'text-cu-text-secondary', bg: 'bg-cu-bg-secondary', dot: 'bg-cu-border', rail: 'border-l-cu-border', label: 'Low' },
};

export const STATUS_TONE: Record<string, { text: string; bg: string; dot: string; label: string }> = {
  TODO: { text: 'text-cu-text-secondary', bg: 'bg-cu-bg-tertiary', dot: 'bg-cu-text-muted', label: 'To do' },
  IN_PROGRESS: { text: 'text-cu-primary', bg: 'bg-cu-primary/10', dot: 'bg-cu-primary', label: 'In progress' },
  IN_REVIEW: { text: 'text-amber-500', bg: 'bg-amber-500/10', dot: 'bg-amber-400', label: 'In review' },
  DONE: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500', label: 'Done' },
};

export function getPriorityStyle(priority?: string | null) {
  if (!priority) return null;
  return PRIORITY_STYLES[priority.toUpperCase()] ?? PRIORITY_STYLES.LOW;
}

export function getStatusTone(status?: string | null) {
  if (!status) return null;
  return STATUS_TONE[status.toUpperCase()] ?? {
    text: 'text-cu-text-secondary',
    bg: 'bg-cu-bg-secondary',
    dot: 'bg-cu-border',
    label: status.replace(/_/g, ' ').toLowerCase(),
  };
}

export function formatCompactDate(value?: string | null) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function getDueDateMeta(dueDate?: string | null, status?: string | null) {
  const label = formatCompactDate(dueDate);
  if (!dueDate || !label) {
    return { label: 'No due date', tone: 'muted' as const, className: 'text-cu-text-muted bg-cu-bg-secondary' };
  }

  const date = new Date(dueDate.includes('T') ? dueDate : `${dueDate}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (status?.toUpperCase() === 'DONE') {
    return { label, tone: 'done' as const, className: 'text-emerald-500 bg-emerald-500/10' };
  }

  if (diffDays < 0) {
    return { label: `Overdue ${label}`, tone: 'overdue' as const, className: 'text-red-500 bg-red-500/10' };
  }

  if (diffDays === 0) {
    return { label: 'Due today', tone: 'today' as const, className: 'text-red-500 bg-red-500/10' };
  }

  if (diffDays <= 5) {
    return { label, tone: 'upcoming' as const, className: 'text-amber-600 bg-amber-500/10' };
  }

  return { label, tone: 'upcoming' as const, className: 'text-cu-text-secondary bg-cu-bg-secondary' };
}

export function getInitial(name?: string | null) {
  return (name?.trim()?.[0] || 'U').toUpperCase();
}

export function getSubtaskStats(subtasks: Array<{ status?: string | null }> = []) {
  const total = subtasks.length;
  const done = subtasks.filter((task) => task.status?.toUpperCase() === 'DONE').length;
  return {
    total,
    done,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export function labelChipStyle(color?: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    backgroundColor: `${color}18`,
    borderColor: `${color}33`,
    color,
  };
}
