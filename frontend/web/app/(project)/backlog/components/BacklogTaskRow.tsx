'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../../kanban/types';
import {
    ChevronDown, ArrowUp, ArrowRight, ArrowDown, Minus,
    MoreHorizontal, RefreshCw
} from 'lucide-react';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import AssigneeAvatar from '../../(agile)/sprint-backlog/components/AssigneeAvatar';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { tasksApi } from '@/services/tasks-contract';
import { formatLocalDate } from '@/lib/date-format';
import 'react-day-picker/dist/style.css';

const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    URGENT: { color: '#EF4444', icon: ArrowUp,    label: 'Urgent' },
    HIGH:   { color: '#EF4444', icon: ArrowUp,    label: 'High'   },
    MEDIUM: { color: '#F59E0B', icon: ArrowRight, label: 'Medium' },
    LOW:    { color: '#22C55E', icon: ArrowDown,  label: 'Low'    },
};

const STATUS_COLOR: Record<string, string> = {
    TODO:        'bg-cu-bg-tertiary text-cu-text-secondary',
    IN_PROGRESS: 'bg-cu-primary/10 text-cu-primary',
    IN_REVIEW:   'bg-amber-400/15 text-amber-500',
    DONE:        'bg-emerald-500/15 text-emerald-500',
};

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

function classifyBacklogDue(dueDate?: string | null, status?: string | null): 'overdue' | 'today' | 'five_days' | 'future' | 'none' {
    if (!dueDate || status?.toUpperCase() === 'DONE') return 'none';
    const due = new Date(dueDate.length === 10 ? `${dueDate}T00:00:00` : dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 5) return 'five_days';
    return 'future';
}

interface BacklogTaskRowProps {
    task: Task;
    onDelete: (id: number) => void;
    onClick: (task: Task) => void;
    onStatusChange: (id: number, status: string) => void;
    onOpenModal: (id: number) => void;
    selected?: boolean;
    onToggleSelect?: (id: number) => void;
    onDateChange?: (id: number, dueDate: string | null) => void;
}

export default function BacklogTaskRow({
    task, onDelete, onClick, onStatusChange, onOpenModal,
    selected, onToggleSelect, onDateChange,
}: BacklogTaskRowProps) {
    const PriorityIcon = task.priority ? (PRIORITY_CONFIG[task.priority]?.icon ?? Minus) : Minus;
    const priorityColor = task.priority ? (PRIORITY_CONFIG[task.priority]?.color ?? '#9CA3AF') : '#9CA3AF';
    const priorityLabel = task.priority ? (PRIORITY_CONFIG[task.priority]?.label ?? task.priority) : '—';
    const normalizedStatus = (task.status ?? '').toUpperCase();
    const statusClass = STATUS_COLOR[normalizedStatus] ?? 'bg-cu-bg-tertiary text-cu-text-secondary';
    const [statusOpen, setStatusOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const dueClass = classifyBacklogDue(task.dueDate, normalizedStatus);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDateChange = async (date: Date | undefined) => {
        const formattedDate = date ? formatLocalDate(date) : null;
        // Optimistic update
        onDateChange?.(task.id, formattedDate);
        try {
            await tasksApi.updateDates(task.id, { dueDate: formattedDate });
        } catch (err) {
            console.error('Failed to update date:', err);
            // Revert state hook could be added if needed
        }
    };

    return (
        <div
            className={`grid grid-cols-[auto_1fr_120px_100px_120px_100px_100px_32px] sm:grid-cols-[auto_1.5fr_140px_110px_130px_110px_120px_32px] items-center gap-x-2 px-3 sm:px-4 min-h-[52px] rounded-lg border cursor-pointer select-none transition-colors ${
                selected
                    ? 'bg-cu-primary/10 border-cu-primary/40 shadow-[inset_2px_0_0_var(--cu-primary)]'
                    : dueClass === 'overdue' || dueClass === 'today'
                        ? 'bg-red-500/10 border-red-500/25 hover:bg-red-500/15'
                        : dueClass === 'five_days'
                            ? 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15'
                            : 'bg-cu-bg-secondary/70 border-cu-border hover:bg-cu-hover'
            }`}
            onClick={() => {
                if (statusOpen || menuOpen) return;
                if (window.innerWidth >= 768) onOpenModal(task.id);
                else onClick(task);
            }}
        >
            {/* Checkbox */}
            <input
                type="checkbox"
                checked={selected ?? false}
                onChange={e => { e.stopPropagation(); onToggleSelect?.(task.id); }}
                onClick={e => e.stopPropagation()}
                className="shrink-0 w-3.5 h-3.5 accent-cu-primary cursor-pointer"
            />

            {/* Title + ID */}
            <div className="min-w-0 flex items-center gap-2 py-2.5">
                <span className="text-[11px] font-mono text-cu-text-muted shrink-0">#{task.id}</span>
                <p className={`text-[14px] font-medium truncate ${normalizedStatus === 'DONE' ? 'line-through text-cu-text-muted' : 'text-cu-text-primary'}`}>
                    {task.title}
                </p>
                {task.recurrenceRule && (
                    <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            task.recurrenceActive === false
                                ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30'
                                : 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30'
                        }`}
                        title={task.recurrenceActive === false ? 'Recurring (Paused)' : `Recurring (${task.recurrenceRule})`}
                    >
                        <RefreshCw size={9} className="flex-shrink-0" />
                        <span>Recurring{task.recurrenceActive === false ? ' (Paused)' : ''}</span>
                    </span>
                )}
            </div>

            {/* Label */}
            <div className="min-w-0 hidden sm:flex items-center">
                {task.labels && task.labels.length > 0 ? (
                    <span style={hexToLabelStyle(task.labels[0].color ?? '#6366F1')} className="px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[110px]">
                        {task.labels[0].name}
                    </span>
                ) : (
                    <span className="text-[11px] text-cu-text-muted">—</span>
                )}
            </div>

            {/* Priority */}
            <div className="min-w-0 flex items-center gap-1">
                <PriorityIcon size={13} color={priorityColor} className="shrink-0" />
                <span className="text-[11px] font-medium text-cu-text-primary hidden sm:inline">{priorityLabel}</span>
            </div>

            {/* Status */}
            <div className="relative" ref={statusRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setStatusOpen(s => !s); }}
                    className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusClass} whitespace-nowrap ring-1 ring-inset ring-current/10`}
                >
                    <span className="max-w-[70px] truncate">{normalizedStatus.replace(/_/g, ' ')}</span>
                    <ChevronDown size={10} className="shrink-0" />
                </button>
                {statusOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-cu-bg border border-cu-border rounded-xl shadow-cu-lg py-1 min-w-[130px]">
                        {STATUS_OPTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, s); setStatusOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors ${normalizedStatus === s ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                            >
                                {s.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Assignee */}
            <div className="min-w-0 flex items-center">
                {task.assignees && task.assignees.length > 0 ? (
                    <div className="flex items-center" title={task.assignees.map(a => a.name).join(', ')}>
                        {task.assignees.slice(0, 3).map((a, idx) => (
                            <span
                                key={a.id}
                                className="inline-block ring-2 ring-cu-bg rounded-full"
                                style={{ marginLeft: idx === 0 ? 0 : -6, zIndex: task.assignees!.length - idx }}
                            >
                                <AssigneeAvatar name={a.name} profilePicUrl={a.avatar} size={22} />
                            </span>
                        ))}
                        {task.assignees.length > 3 && (
                            <span
                                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-cu-bg-tertiary ring-2 ring-cu-bg text-[9px] font-bold text-cu-text-secondary"
                                style={{ marginLeft: -6 }}
                            >
                                +{task.assignees.length - 3}
                            </span>
                        )}
                    </div>
                ) : task.assigneeName ? (
                    <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
                ) : (
                    <span className="text-[11px] text-cu-text-muted">—</span>
                )}
            </div>

            {/* Due Date */}
            <div className="min-w-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <button className={`text-[11px] font-medium border px-2 py-1 rounded transition-colors truncate ${
                            dueClass === 'overdue' || dueClass === 'today'
                                ? 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                : dueClass === 'five_days'
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                    : 'text-cu-text-muted hover:text-cu-primary bg-transparent border-transparent hover:border-cu-primary/30 hover:bg-cu-primary/10'
                        }`}>
                            {dueClass === 'overdue' ? 'Overdue' : dueClass === 'today' ? 'Due today' : task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'No date'}
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content className="z-[var(--cu-z-modal-popover)] p-3 bg-cu-bg rounded-xl shadow-cu-xl border border-cu-border" sideOffset={5}>
                            <DayPicker
                                mode="single"
                                selected={task.dueDate ? parseISO(task.dueDate) : undefined}
                                onSelect={handleDateChange}
                                showOutsideDays
                            />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>

            {/* Menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                    className="p-1 rounded hover:bg-cu-hover text-cu-text-muted transition-colors"
                >
                    <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-cu-bg border border-cu-border rounded-xl shadow-cu-lg py-1 min-w-[120px]">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpenModal(task.id); }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-cu-text-primary hover:bg-cu-hover transition-colors"
                        >
                            Edit
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(task.id); }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-cu-danger hover:bg-cu-danger/10 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
