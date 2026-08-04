'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Sprintcolumn } from '../types';
import SprintCard from './SprintCard';
import { Plus, GripVertical, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { SprintTeamMemberOption } from '../api';

interface SprintColumnProps {
  column: Sprintcolumn;
  onInlineCreate?: (title: string, status: string) => Promise<void> | void;
  onOpenTask?: (id: number) => void;
  dense?: boolean;
  compactEmpty?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: (status: string) => void;
  selectedTaskIds?: Set<number>;
  onToggleTaskSelected?: (taskId: number, selected: boolean) => void;
  onUpdateTaskDueDate?: (taskId: number, dueDate: string | null) => Promise<void>;
  onAssignTaskSingle?: (taskId: number, userId: number) => Promise<void>;
  onAssignTaskMultiple?: (taskId: number, assigneeIds: number[]) => Promise<void>;
  teamMembers?: SprintTeamMemberOption[];
  projectKey?: string;
}

export default function SprintColumn({
  column,
  onInlineCreate,
  onOpenTask,
  dense = false,
  compactEmpty = true,
  collapsed = false,
  onToggleCollapsed,
  selectedTaskIds,
  onToggleTaskSelected,
  onUpdateTaskDueDate,
  onAssignTaskSingle,
  onAssignTaskMultiple,
  teamMembers = [],
  projectKey,
}: SprintColumnProps) {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineTitleLength, setInlineTitleLength] = useState(0);
  const { setNodeRef } = useDroppable({
    id: column.columnStatus,
    data: { type: 'column', columnStatus: column.columnStatus },
  });

  const getColumnBgColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'TODO':
        return 'bg-cu-bg-secondary';
      case 'IN_PROGRESS':
        return 'bg-cu-primary/5';
      case 'IN_REVIEW':
        return 'bg-amber-400/5';
      case 'DONE':
        return 'bg-emerald-500/5';
      default:
        return 'bg-cu-bg-secondary';
    }
  };

  const getTitleColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'TODO':
        return 'text-cu-primary';
      case 'IN_PROGRESS':
        return 'text-cu-primary';
      case 'IN_REVIEW':
        return 'text-amber-500';
      case 'DONE':
        return 'text-emerald-500';
      default:
        return 'text-cu-text-primary';
    }
  };

  const taskIds = column.tasks.map((task) => task.taskId.toString());
  const sortable = useSortable({ id: `column-${column.id}` });
  const sortableStyle = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const isEmpty = column.tasks.length === 0;
  const isCompact = compactEmpty && isEmpty && !inlineOpen && !collapsed;
  const columnWidth = collapsed ? 72 : (isCompact ? 220 : (dense ? 300 : 330));
  const overdue = column.tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE').length;

  return (
    <motion.div 
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.2 }}
      animate={{ width: columnWidth }}
      style={sortableStyle}
      className={`flex flex-col h-full min-w-0 rounded-xl border border-cu-border ${getColumnBgColor(column.columnStatus)} p-2 snap-center snap-always shadow-cu-sm transition-all duration-200`}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 rounded-lg border border-cu-border bg-cu-bg/95 backdrop-blur px-2.5 py-2 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onToggleCollapsed?.(column.columnStatus)}
            className="rounded-md p-0.5 text-cu-text-muted hover:bg-cu-hover hover:text-cu-text-primary"
            title={collapsed ? 'Expand column' : 'Collapse column'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="rounded-md p-0.5 text-cu-text-muted hover:bg-cu-hover hover:text-cu-text-primary"
            title="Drag to reorder column"
          >
            <GripVertical size={13} className="text-cu-text-muted" />
          </button>
          {!collapsed && (
          <h3 className={`font-semibold text-[12px] uppercase tracking-wider truncate ${getTitleColor(column.columnStatus)}`}>
            {column.columnName}
          </h3>
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setInlineOpen(true)}
              className="p-1 text-cu-text-muted hover:text-cu-primary hover:bg-cu-primary/10 rounded-md transition-colors"
              title="Add task"
            >
              <Plus size={14} />
            </button>
            <div className="relative group/menu">
              <button
                className="p-1 text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-hover rounded-md transition-colors"
                title="Column options"
              >
                <MoreHorizontal size={14} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-cu-bg rounded-lg shadow-cu-lg border border-cu-border py-1 z-20 invisible group-hover/menu:visible opacity-0 group-hover/menu:opacity-100 transition-all">
                <button className="w-full px-3 py-1.5 text-left text-xs text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary">Rename column</button>
                <button className="w-full px-3 py-1.5 text-left text-xs text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary">Change color</button>
                <button className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-500/10">Delete column</button>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-cu-text-muted ml-1">
              {overdue > 0 && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-500">{overdue} overdue</span>}
            </div>
          </div>
        )}
      </div>

      {/* Column Content */}
      {!collapsed && (
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-1 space-y-2.5 no-scrollbar"
        style={{ minHeight: '150px' }}
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.length > 0 ? (
            column.tasks.map((task) => (
              <SprintCard
                key={task.taskId}
                task={task}
                onOpenTask={onOpenTask}
                dense={dense}
                selected={selectedTaskIds?.has(task.taskId)}
                onToggleSelect={onToggleTaskSelected}
                onUpdateDueDate={onUpdateTaskDueDate}
                onAssignSingle={onAssignTaskSingle}
                onAssignMultiple={onAssignTaskMultiple}
                teamMembers={teamMembers}
                projectKey={projectKey}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-20 text-cu-text-muted border-2 border-dashed border-cu-border rounded-xl bg-cu-bg/50">
              <p className="text-[11px] font-medium">Drop tasks here</p>
            </div>
          )}
        </SortableContext>
      </div>
      )}

      {/* Create Task Button / Inline Input */}
      {!collapsed && (
      <div className="mt-3 pb-1">
        {inlineOpen ? (
          <>
            <input
              autoFocus
              maxLength={255}
              value={inlineTitle}
              onChange={(e) => {
                setInlineTitle(e.target.value);
                setInlineTitleLength(e.target.value.length);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inlineTitle.trim()) {
                  const title = inlineTitle.trim();
                  setInlineTitle('');
                  setInlineTitleLength(0);
                  setInlineOpen(false);
                  void onInlineCreate?.(title, column.columnStatus);
                }
                if (e.key === 'Escape') {
                  setInlineOpen(false);
                  setInlineTitle('');
                  setInlineTitleLength(0);
                }
              }}
              onBlur={() => {
                setInlineOpen(false);
                setInlineTitle('');
                setInlineTitleLength(0);
              }}
              className="w-full px-3 py-2 text-sm border border-cu-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-cu-primary/20 bg-cu-bg text-cu-text-primary shadow-cu-sm placeholder:text-cu-text-muted"
              placeholder="Task name… (Enter to save)"
            />
            {inlineTitleLength > 200 && (
              <p className="text-xs text-amber-500 mt-1">
                {255 - inlineTitleLength} characters remaining
              </p>
            )}
          </>
        ) : (
          <button
            onClick={() => setInlineOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cu-bg hover:bg-cu-hover border border-cu-border rounded-xl text-[13px] font-semibold text-cu-text-secondary hover:text-cu-text-primary shadow-cu-sm transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
            aria-label={`Add task in ${column.columnName}`}
          >
            <Plus size={18} className="text-cu-text-muted group-hover:text-cu-primary" />
            <span>Add task</span>
          </button>
        )}
      </div>
      )}
    </motion.div>
  );
}
