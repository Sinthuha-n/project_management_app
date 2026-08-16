'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, Pencil, Tag, Trash2, UserPlus, RefreshCw } from 'lucide-react';
import AssigneeAvatar from '../AssigneeAvatar';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { STATUS_LABELS, DUE_CHIP_STYLES, type TaskStatus, formatDate } from './TaskRowConstants';
import type { TaskRowProps } from '../TaskRow';
import { useTaskRowState } from './useTaskRowState';

export default function DesktopTaskRow(props: TaskRowProps) {
  const {
    task, projectKey, teamMembers = [], loadingMembers = false,
    canDelete = true, showCheckbox = false, onToggle, onStatusChange,
    onStoryPointsChange, onAssignTask, onDueDateChange, onDeleteTask,
    onOpenTask, projectLabels = [], onAddLabel, onRemoveLabel, onCreateLabel,
    extraStatuses = [], hideStatus = false,
  } = props;

  const {
    statusRef, assignRef, labelRef, dateRef,
    statusPortalRef, assignPortalRef, labelPortalRef,
    lastTapRef,
    statusOpen, setStatusOpen,
    assignOpen, setAssignOpen,
    labelOpen, setLabelOpen,
    renaming,
    renameValue, setRenameValue,
    labelInput, setLabelInput,
    creatingLabel,
    statusPosition, assignPosition, labelPosition,
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, updateLastTap, commitRename, cancelRename,
    taskLabelIds, openLabel, handleLabelToggle, handleCreateLabelFromInput,
    openStatus, openAssign, openDatePicker,
    displayLabel, displayStyle, dueClass, statusBorderColor, priorityKey, priorityStyle,
  } = useTaskRowState(task, {
    canDelete, onDeleteTask, onRenameTask: props.onRenameTask,
    onAddLabel, onRemoveLabel, onCreateLabel, extraStatuses, projectLabels,
  });

  const displayTaskKey = projectKey ? `#${projectKey}-${task.taskNo || task.id}` : `#${task.taskNo || task.id}`;
  const getMemberName = (m: NonNullable<typeof teamMembers>[number]) => m.user.fullName || m.user.username;

  const rowBg =
    dueClass === 'five_days' ? 'bg-amber-50 dark:bg-amber-900/15'
    : dueClass === 'old' ? 'bg-cu-danger-light'
    : dueClass === 'overdue' || dueClass === 'today' ? 'bg-cu-danger-light'
    : dueClass === 'soon' ? 'bg-cu-bg-secondary'
    : 'bg-cu-bg';

  return (
    <div
      className={`group relative flex items-center min-h-[40px] rounded-lg border-2 border-transparent ${rowBg} hover:opacity-90 transition-colors duration-150`}
      style={{ borderLeft: `3px solid ${statusBorderColor}` }}
      onClick={() => { if (!renaming) onOpenTask?.(task.id); }}
      onTouchStart={onTouchStartInternal}
      onTouchEnd={onTouchEndInternal}
      onTouchMove={onTouchMoveInternal}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <div className="pl-2 pr-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox" checked={task.selected ?? false}
            onChange={() => onToggle?.(task.id)}
            className="h-4 w-4 rounded border-cu-border accent-cu-primary cursor-pointer"
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}

      {/* Task number */}
      <div className="flex-shrink-0 w-[130px] pl-2 pr-1 flex items-center justify-start">
        <span className="inline-flex max-w-full items-center rounded-md bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-cu-text-secondary truncate" title={displayTaskKey}>
          {displayTaskKey}
        </span>
      </div>

      {/* Priority */}
      <div className="flex-shrink-0 w-[78px] px-1 flex items-center" onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wide truncate ${priorityStyle}`}>
          {priorityStyle ? priorityKey : '—'}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 px-2 flex items-center gap-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {renaming ? (
          <div className="flex-1 min-w-0">
            <input
              type="text" value={renameValue}
              maxLength={255}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void commitRename(); }
                if (e.key === 'Escape') cancelRename();
              }}
              onBlur={() => void commitRename()}
              autoFocus
              className="w-full border-b-2 border-cu-primary bg-transparent text-[12px] font-semibold text-cu-text-primary outline-none"
            />
            {renameValue.length > 200 && (
              <p className="text-xs text-amber-500 mt-1">{255 - renameValue.length} characters remaining</p>
            )}
          </div>
        ) : (
          <>
            <span
              className={`text-[12px] font-medium truncate min-w-0 select-none ${
                dueClass === 'five_days' ? 'text-amber-800 dark:text-amber-300' :
                task.status?.toUpperCase() === 'DONE' ? 'line-through text-cu-text-muted' : 'text-cu-text-primary'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                const now = Date.now();
                if (lastTapRef.current > 0 && now - lastTapRef.current < 300) {
                  startRename(e);
                  updateLastTap(0);
                } else {
                  updateLastTap(now);
                  onOpenTask?.(task.id);
                }
              }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(e); }}
            >
              {task.title}
            </span>
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
            {task.labels?.[0] && (
              <span style={hexToLabelStyle(task.labels[0].color ?? '#6366F1')} className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border border-white/40">
                {task.labels[0].name}
              </span>
            )}
          </>
        )}
      </div>

      {/* Assignee */}
      <div className="flex-shrink-0 w-[52px] flex items-center justify-center relative" ref={assignRef} onClick={(e) => e.stopPropagation()}>
        <button type="button"
          title={
            task.assignees && task.assignees.length > 0
              ? task.assignees.map((a) => a.name).join(', ')
              : (task.assigneeName || 'Assign')
          }
          onClick={() => openAssign()}
          className="flex items-center"
        >
          {task.assignees && task.assignees.length > 0 ? (
            // Multi-assignee avatar stack
            <div className="flex items-center">
              {task.assignees.slice(0, 3).map((a, idx) => (
                <span
                  key={a.id}
                  className="inline-block ring-2 ring-cu-bg rounded-full"
                  style={{ marginLeft: idx === 0 ? 0 : -6, zIndex: task.assignees!.length - idx }}
                >
                  <AssigneeAvatar name={a.name} profilePicUrl={a.avatar} size={20} />
                </span>
              ))}
              {task.assignees.length > 3 && (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cu-bg-tertiary ring-2 ring-cu-bg text-[9px] font-bold text-cu-text-secondary"
                  style={{ marginLeft: -6 }}
                >
                  +{task.assignees.length - 3}
                </span>
              )}
            </div>
          ) : task.assigneeName && task.assigneeName !== 'Unassigned' ? (
            <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
          ) : (
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-cu-border hover:border-cu-primary transition-colors">
              <UserPlus size={11} className="text-cu-text-secondary" />
            </div>
          )}
        </button>
        {assignOpen && typeof document !== 'undefined' && createPortal(
          <div ref={assignPortalRef} className="fixed z-[var(--cu-z-dropdown)] w-52 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl" style={{ top: assignPosition.top, left: assignPosition.left }}>
            <div className="px-3 py-2 text-[10px] font-bold text-cu-text-secondary uppercase tracking-wider border-b border-cu-border bg-cu-bg-secondary">Assign To</div>
            {loadingMembers ? (
              <div className="px-3 py-3 text-[12px] text-cu-text-secondary">Loading…</div>
            ) : teamMembers.length > 0 ? (
              <div className="max-h-52 overflow-y-auto">
                {teamMembers.map((m) => (
                  <button key={m.user.userId} onClick={() => { void onAssignTask(task.id, m.user.userId); setAssignOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-cu-text-primary hover:bg-cu-hover"
                  >
                    <AssigneeAvatar name={getMemberName(m)} profilePicUrl={m.user.profilePicUrl} size={20} />
                    <span className="truncate">{getMemberName(m)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-[12px] text-cu-text-secondary">No members found</div>
            )}
          </div>,
          document.body
        )}
      </div>


      {/* Status dropdown */}
      {!hideStatus && (
        <div className="flex-shrink-0 w-[116px] px-1 flex items-center relative" ref={statusRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openStatus()}
            className={`flex h-6 w-full items-center justify-between gap-1 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide transition-all ${displayStyle}`}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown size={9} className="flex-shrink-0 opacity-60" />
          </button>
          {statusOpen && typeof document !== 'undefined' && createPortal(
            <div ref={statusPortalRef} className="fixed z-[var(--cu-z-dropdown)] w-32 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl" style={{ top: statusPosition.top, left: statusPosition.left }}>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <button key={s} onClick={() => { onStatusChange(task.id, s); setStatusOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-cu-hover ${task.status?.toUpperCase() === s ? 'text-cu-primary' : 'text-cu-text-primary'}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              {extraStatuses.length > 0 && <div className="border-t border-cu-border my-1" />}
              {extraStatuses.map((s) => (
                <button key={s.value} onClick={() => { onStatusChange(task.id, s.value); setStatusOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-cu-hover ${task.status?.toUpperCase() === s.value ? 'text-cu-primary' : 'text-cu-text-primary'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Due date */}
      {onDueDateChange && (
        <div className="flex-shrink-0 w-[88px] px-1 flex items-center relative" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={openDatePicker} title={dueClass === 'overdue' ? formatDate(task.dueDate) : undefined}
            className={`flex h-6 w-full items-center justify-center gap-1 rounded-md px-2 text-[10px] font-bold transition-all border ${
              dueClass === 'none' ? 'bg-cu-bg border-cu-border text-cu-text-secondary hover:bg-cu-hover' : DUE_CHIP_STYLES[dueClass]
            }`}
          >
            <CalendarDays size={10} className="flex-shrink-0 opacity-60" />
            <span className="truncate">{dueClass === 'overdue' ? 'Overdue' : formatDate(task.dueDate)}</span>
          </button>
          <input ref={dateRef} type="date" value={task.dueDate || ''} onChange={(e) => onDueDateChange(task.id, e.target.value)} className="sr-only" />
        </div>
      )}

      {/* Story points */}
      <div className="flex-shrink-0 w-[40px] px-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-6 w-full items-center justify-center rounded-md border border-cu-border bg-cu-bg-secondary">
          <input type="number" min="0" value={task.storyPoints}
            onChange={(e) => onStoryPointsChange(task.id, Number(e.target.value))}
            className="w-full text-center text-[12px] font-bold text-cu-text-primary outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Label picker */}
      {(onAddLabel || onCreateLabel) && (
        <div className="flex-shrink-0 w-[26px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" ref={labelRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { if (labelOpen) setLabelOpen(false); else openLabel(); }} title="Labels"
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${labelOpen ? 'bg-cu-primary-light text-cu-primary' : 'text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light'}`}
          >
            <Tag size={12} />
          </button>
          {labelOpen && typeof document !== 'undefined' && createPortal(
            <div ref={labelPortalRef} className="fixed z-[var(--cu-z-dropdown)] w-56 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl" style={{ top: labelPosition.top, left: labelPosition.left }}>
              <div className="px-3 py-2 border-b border-cu-border">
                <input autoFocus type="text" value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateLabelFromInput(); } if (e.key === 'Escape') { setLabelOpen(false); setLabelInput(''); } }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="New label name + Enter" disabled={creatingLabel}
                  className="w-full text-[12px] text-cu-text-primary placeholder:text-cu-text-tertiary bg-transparent outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {projectLabels.length === 0 && <div className="px-3 py-3 text-[12px] text-cu-text-tertiary">No labels yet</div>}
                {projectLabels.map((label) => {
                  const active = taskLabelIds.has(label.id);
                  return (
                    <button key={label.id} type="button" onClick={(e) => { e.stopPropagation(); void handleLabelToggle(label); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] hover:bg-cu-hover transition-colors"
                    >
                      <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color ?? '#6B7280' }} />
                      <span className="flex-1 text-left truncate text-cu-text-primary font-medium">{label.name}</span>
                      {active && (
                        <span className="h-4 w-4 rounded-full bg-cu-primary flex items-center justify-center flex-shrink-0">
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Rename / Delete actions */}
      <div className="flex-shrink-0 w-[52px] pl-1 pr-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={startRename} title="Rename" className="flex h-6 w-6 items-center justify-center rounded-md text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light transition-all">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={() => canDelete && onDeleteTask(task.id)} disabled={!canDelete} title={canDelete ? 'Delete task' : 'Viewers cannot delete tasks'}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${canDelete ? 'text-cu-text-secondary hover:text-cu-danger hover:bg-cu-danger-light' : 'text-cu-text-muted cursor-not-allowed'}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
