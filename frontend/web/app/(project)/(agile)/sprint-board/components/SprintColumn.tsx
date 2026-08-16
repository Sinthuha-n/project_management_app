'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { Plus, GripVertical, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Palette, Trash2, Check, AlertCircle } from 'lucide-react';
import { SprintTeamMemberOption } from '../api';

const COLOR_PRESETS = [
  { label: 'Default', value: null, hex: 'transparent' },
  { label: 'Indigo', value: '#6366F1', hex: '#6366F1' },
  { label: 'Blue', value: '#3B82F6', hex: '#3B82F6' },
  { label: 'Cyan', value: '#06B6D4', hex: '#06B6D4' },
  { label: 'Emerald', value: '#10B981', hex: '#10B981' },
  { label: 'Amber', value: '#F59E0B', hex: '#F59E0B' },
  { label: 'Rose', value: '#F43F5E', hex: '#F43F5E' },
  { label: 'Purple', value: '#8B5CF6', hex: '#8B5CF6' },
  { label: 'Slate', value: '#475569', hex: '#475569' },
];

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
  onRenameTask?: (taskId: number, title: string) => Promise<void> | void;
  onDeleteTask?: (taskId: number) => Promise<void> | void;
  onRenameColumn?: (columnId: number, newName: string) => Promise<void> | void;
  onChangeColumnColor?: (columnId: number, color: string | null) => Promise<void> | void;
  onDeleteColumn?: (columnId: number) => Promise<void> | void;
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
  onRenameTask,
  onDeleteTask,
  onRenameColumn,
  onChangeColumnColor,
  onDeleteColumn,
  teamMembers = [],
  projectKey,
}: SprintColumnProps) {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineTitleLength, setInlineTitleLength] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [columnNameInput, setColumnNameInput] = useState(column.columnName);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: column.columnStatus,
    data: { type: 'column', columnStatus: column.columnStatus, columnId: column.id },
  });

  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableNodeRef,
    transform: sortableTransform,
    transition: sortableTransition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id, columnStatus: column.columnStatus },
  });

  useEffect(() => {
    setColumnNameInput(column.columnName);
  }, [column.columnName]);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getColumnBgStyle = () => {
    if (column.color) {
      return {
        backgroundColor: `${column.color}08`,
        borderTopColor: column.color,
        borderTopWidth: 3,
      };
    }
    switch (column.columnStatus.toUpperCase()) {
      case 'TODO':
        return { backgroundColor: 'var(--cu-bg-secondary)' };
      case 'IN_PROGRESS':
        return { backgroundColor: 'rgba(99, 102, 241, 0.04)' };
      case 'IN_REVIEW':
        return { backgroundColor: 'rgba(245, 158, 11, 0.04)' };
      case 'DONE':
        return { backgroundColor: 'rgba(16, 185, 129, 0.04)' };
      default:
        return { backgroundColor: 'var(--cu-bg-secondary)' };
    }
  };

  const getTitleColorClass = (status: string) => {
    if (column.color) return 'text-cu-text-primary';
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
  const sortableStyle = {
    transform: CSS.Transform.toString(sortableTransform),
    transition: sortableTransition,
    ...getColumnBgStyle(),
  };

  const isEmpty = column.tasks.length === 0;
  const isCompact = compactEmpty && isEmpty && !inlineOpen && !collapsed;
  const columnWidth = collapsed ? 72 : (isCompact ? 220 : (dense ? 300 : 330));
  const overdue = column.tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE').length;

  const handleCommitRename = () => {
    const trimmed = columnNameInput.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== column.columnName) {
      void onRenameColumn?.(column.id, trimmed);
    } else {
      setColumnNameInput(column.columnName);
    }
  };

  const handleSelectColor = (color: string | null) => {
    setColorPickerOpen(false);
    setMenuOpen(false);
    void onChangeColumnColor?.(column.id, color);
  };

  const handleDeleteColumnClick = () => {
    setMenuOpen(false);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    setDeleteConfirmOpen(false);
    void onDeleteColumn?.(column.id);
  };

  return (
    <motion.div
      ref={setSortableNodeRef}
      whileHover={{ scale: 1.002 }}
      transition={{ duration: 0.2 }}
      animate={{ width: columnWidth }}
      style={sortableStyle}
      className={`flex flex-col h-full min-w-0 rounded-xl border border-cu-border p-2 snap-center snap-always shadow-cu-sm transition-all duration-200 ${
        isColumnDragging ? 'opacity-40 ring-2 ring-cu-primary' : ''
      }`}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 rounded-lg border border-cu-border bg-cu-bg/95 backdrop-blur px-2.5 py-2 flex items-center justify-between mb-2 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onToggleCollapsed?.(column.columnStatus)}
            className="rounded-md p-0.5 text-cu-text-muted hover:bg-cu-hover hover:text-cu-text-primary transition-colors flex-shrink-0"
            title={collapsed ? 'Expand column' : 'Collapse column'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            {...sortableAttributes}
            {...sortableListeners}
            className="rounded-md p-0.5 text-cu-text-muted hover:bg-cu-hover hover:text-cu-text-primary cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
            title="Drag to reorder column"
          >
            <GripVertical size={13} className="text-cu-text-muted" />
          </button>

          {!collapsed && (
            isRenaming ? (
              <div className="flex-1 min-w-0 mr-1">
                <input
                  autoFocus
                  type="text"
                  value={columnNameInput}
                  maxLength={50}
                  onChange={(e) => setColumnNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCommitRename();
                    }
                    if (e.key === 'Escape') {
                      setIsRenaming(false);
                      setColumnNameInput(column.columnName);
                    }
                  }}
                  onBlur={handleCommitRename}
                  className="w-full rounded border border-cu-primary bg-cu-bg px-1.5 py-0.5 text-[12px] font-semibold uppercase text-cu-text-primary focus:outline-none focus:ring-1 focus:ring-cu-primary"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {column.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: column.color }}
                  />
                )}
                <h3
                  className={`font-semibold text-[12px] uppercase tracking-wider truncate cursor-pointer hover:underline ${getTitleColorClass(
                    column.columnStatus
                  )}`}
                  onClick={() => setIsRenaming(true)}
                  title="Click to rename column"
                >
                  {column.columnName}
                </h3>
                <span className="text-[11px] font-medium text-cu-text-muted">
                  ({column.tasks.length})
                </span>
              </div>
            )
          )}
        </div>

        {!collapsed && (
          <div className="flex items-center gap-1 ml-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setInlineOpen(true)}
              className="p-1 text-cu-text-muted hover:text-cu-primary hover:bg-cu-primary/10 rounded-md transition-colors"
              title="Add task"
            >
              <Plus size={14} />
            </button>

            {/* Column Options Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="p-1 text-cu-text-muted hover:text-cu-text-primary hover:bg-cu-hover rounded-md transition-colors"
                title="Column options"
              >
                <MoreHorizontal size={14} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-cu-border bg-cu-bg p-1 shadow-cu-xl z-30 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setIsRenaming(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-cu-text-primary hover:bg-cu-hover transition-colors text-left"
                  >
                    <Pencil size={13} className="text-cu-text-muted" />
                    <span>Rename column</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setColorPickerOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-cu-text-primary hover:bg-cu-hover transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Palette size={13} className="text-cu-text-muted" />
                      <span>Change color</span>
                    </div>
                    {column.color && (
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                    )}
                  </button>

                  {/* Color presets dropdown sub-view */}
                  {colorPickerOpen && (
                    <div className="my-1 border-t border-cu-border pt-1 px-2 pb-1 grid grid-cols-5 gap-1.5">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleSelectColor(preset.value)}
                          className={`h-5 w-5 rounded-full border border-cu-border flex items-center justify-center transition-transform hover:scale-110 ${
                            column.color === preset.value || (!column.color && preset.value === null)
                              ? 'ring-2 ring-cu-primary ring-offset-1'
                              : ''
                          }`}
                          style={{
                            backgroundColor: preset.value ?? 'var(--cu-bg-tertiary)',
                          }}
                          title={preset.label}
                        >
                          {(column.color === preset.value || (!column.color && preset.value === null)) && (
                            <Check size={10} className={preset.value ? 'text-white' : 'text-cu-text-primary'} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="my-1 border-t border-cu-border" />

                  <button
                    type="button"
                    onClick={handleDeleteColumnClick}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <Trash2 size={13} />
                    <span>Delete column</span>
                  </button>
                </div>
              )}
            </div>

            {overdue > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-cu-text-muted ml-0.5">
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-500 font-semibold">{overdue} overdue</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal / Warning */}
      {deleteConfirmOpen && (
        <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs shadow-cu-sm animate-in fade-in">
          {column.tasks.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                <AlertCircle size={14} />
                <span>Cannot Delete Column</span>
              </div>
              <p className="text-[11px] text-cu-text-secondary">
                This column contains {column.tasks.length} task(s). Move or delete tasks before deleting the column.
              </p>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="w-full rounded-md border border-cu-border bg-cu-bg py-1 text-center font-medium text-cu-text-primary hover:bg-cu-hover"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold text-red-600 dark:text-red-400">
                Delete column &quot;{column.columnName}&quot;?
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="rounded px-2 py-1 text-[11px] font-medium text-cu-text-secondary hover:bg-cu-hover"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Column Content / Droppable Task Container */}
      {!collapsed && (
        <div
          ref={setDroppableNodeRef}
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
                  onRenameTask={onRenameTask}
                  onDeleteTask={onDeleteTask}
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
