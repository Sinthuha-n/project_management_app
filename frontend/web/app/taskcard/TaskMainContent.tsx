'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Paperclip, CheckSquare, Link2, Loader2, X, Calendar, Flag, GitBranch, Tag, Users } from 'lucide-react';
import SubtaskList from './SubtaskList';
import CommentSection from './CommentSection';
import DescriptionEditor from './main/DescriptionEditor';
import AttachmentsPanel from './main/AttachmentsPanel';
import { UPLOAD_STATE_MESSAGE } from '@/lib/upload-state';
import { useTaskAttachments } from '@/hooks/useTaskAttachments';
import api from '@/lib/axios';
import TaskActionButton from './components/TaskActionButton';
import DependencyPicker from './components/DependencyPicker';
import {
  getDueDateMeta,
  getInitial,
  getPriorityStyle,
  getStatusTone,
  labelChipStyle,
  type TaskLabelChip,
  type TaskPersonChip,
} from './components/taskUi';

interface Dependency {
  id: number;
  title: string;
  relation: string;
  status?: string;
}

interface TaskMainContentProps {
  title: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subtasks: any[];
  dependencies: Dependency[];
  taskId?: number;
  projectId?: number;
  onUpdateTitle?: (title: string) => void;
  onUpdateDescription?: (description: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubtaskAdded?: (subtask: any) => void;
  onDependencyChanged?: () => void;
  readOnly?: boolean;
  overview?: {
    status?: string;
    priority?: string;
    dueDate?: string | null;
    storyPoint?: number | null;
    labels?: TaskLabelChip[];
    assignees?: TaskPersonChip[];
    githubIssueNumber?: number | null;
    githubRepoFullName?: string | null;
    archived?: boolean;
  };
}

const TaskOverviewStrip = ({ overview }: { overview?: TaskMainContentProps['overview'] }) => {
  if (!overview) return null;
  const statusTone = getStatusTone(overview.status);
  const priority = getPriorityStyle(overview.priority);
  const due = getDueDateMeta(overview.dueDate, overview.status);
  const labels = overview.labels ?? [];
  const assignees = overview.assignees?.filter((person) => person.name) ?? [];

  return (
    <div className="mb-5 rounded-xl border border-cu-border bg-cu-bg-secondary/70 p-3 shadow-cu-sm">
      <div className="flex flex-wrap items-center gap-2">
        {statusTone && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone.bg} ${statusTone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
            {statusTone.label}
          </span>
        )}
        {priority && overview.priority && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${priority.bg} ${priority.text}`}>
            <Flag size={11} />
            {priority.label}
          </span>
        )}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${due.className}`}>
          <Calendar size={11} />
          {due.label}
        </span>
        {overview.storyPoint != null && overview.storyPoint > 0 && (
          <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-500">
            {overview.storyPoint} pt
          </span>
        )}
        {overview.githubIssueNumber && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cu-bg px-2.5 py-1 text-[11px] font-bold text-cu-text-secondary ring-1 ring-cu-border">
            <GitBranch size={11} />
            GH #{overview.githubIssueNumber}
          </span>
        )}
        {overview.archived && (
          <span className="inline-flex items-center rounded-full bg-cu-warning/10 px-2.5 py-1 text-[11px] font-bold text-cu-warning">
            Archived
          </span>
        )}
      </div>
      {(labels.length > 0 || assignees.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cu-border pt-3">
          {labels.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Tag size={12} className="text-cu-text-muted" />
              {labels.slice(0, 4).map((label) => (
                <span
                  key={label.id ?? label.name}
                  style={labelChipStyle(label.color)}
                  className="inline-flex max-w-[140px] items-center rounded-full border border-cu-border bg-cu-bg px-2 py-0.5 text-[11px] font-semibold text-cu-text-secondary"
                >
                  <span className="truncate">{label.name}</span>
                </span>
              ))}
              {labels.length > 4 && <span className="text-[11px] font-semibold text-cu-text-muted">+{labels.length - 4}</span>}
            </div>
          )}
          {assignees.length > 0 && (
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Users size={12} className="text-cu-text-muted" />
              <div className="flex -space-x-2">
                {assignees.slice(0, 4).map((person) => (
                  <div
                    key={person.name}
                    title={person.name}
                    className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-cu-bg bg-cu-primary text-[10px] font-bold text-white shadow-cu-sm"
                  >
                    {person.photoUrl ? (
                      <Image src={person.photoUrl} alt={person.name} width={28} height={28} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      getInitial(person.name)
                    )}
                  </div>
                ))}
              </div>
              {assignees.length > 4 && <span className="text-[11px] font-semibold text-cu-text-muted">+{assignees.length - 4}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TaskMainContent: React.FC<TaskMainContentProps> = ({ 
  title, 
  description, 
  subtasks, 
  dependencies, 
  taskId,
  projectId,
  onUpdateTitle,
  onUpdateDescription,
  onSubtaskAdded,
  onDependencyChanged,
  readOnly = false,
  overview,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [subtaskAddTrigger, setSubtaskAddTrigger] = useState(0);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const { attachments, isUploading, uploadState, error: attachError, uploadFile, removeFile } = useTaskAttachments(taskId);

  useEffect(() => {
    queueMicrotask(() => setEditedTitle(title));
  }, [title]);

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== title) {
      onUpdateTitle?.(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex-1 min-h-0 overflow-visible md:overflow-y-auto p-4 sm:p-5 md:p-6 border-r-0 md:border-r border-cu-border scrollbar-thin scrollbar-thumb-cu-border bg-cu-bg">
      
      {/* Title */}
      <div className="group mb-6">
        {isEditingTitle ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') {
                setEditedTitle(title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="w-full text-[22px] font-bold text-cu-text-primary bg-cu-bg border-2 border-cu-primary rounded-lg px-2 py-1 focus:outline-none font-outfit tracking-tight"
          />
        ) : (
          <h1 
            onClick={() => !readOnly && setIsEditingTitle(true)}
            className={`text-[22px] font-bold text-cu-text-primary tracking-tight px-2 py-1 rounded-lg -ml-2 transition-colors font-outfit ${readOnly ? '' : 'hover:bg-cu-hover cursor-text'}`}
          >
            {title}
          </h1>
        )}
      </div>

      <TaskOverviewStrip overview={overview} />

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2 mb-6 rounded-xl border border-cu-border bg-cu-bg-secondary/60 p-2">
        <TaskActionButton
          icon={isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          label={isUploading ? 'Uploading...' : 'Attach'}
          onClick={() => !isUploading && attachInputRef.current?.click()}
          disabled={readOnly || isUploading}
          title={readOnly ? 'Viewers cannot add attachments' : 'Attach file'}
        />
        <input
          ref={attachInputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await uploadFile(file);
              e.target.value = '';
            }
          }}
        />
        <TaskActionButton
          icon={<CheckSquare size={14} />}
          label="Add subtask"
          onClick={() => !readOnly && setSubtaskAddTrigger(n => n + 1)}
          disabled={readOnly}
          title={readOnly ? 'Viewers cannot add subtasks' : 'Add subtask'}
        />
        <TaskActionButton
          icon={<Link2 size={14} />}
          label="Link issue"
          onClick={() => !readOnly && taskId && projectId && setShowDependencyPicker(true)}
          disabled={readOnly || !taskId || !projectId}
          title={!projectId ? 'Project context is required to link dependencies' : readOnly ? 'Viewers cannot link dependencies' : 'Link task dependency'}
        />
      </div>
      {(attachError || (uploadState && uploadState !== 'visible')) && (
        <p role="status" aria-live="polite" className={`text-xs px-3 py-1.5 rounded mb-4 ${attachError ? 'text-cu-danger bg-cu-danger/10 border border-cu-danger/20' : 'text-cu-text-secondary bg-cu-bg-secondary border border-cu-border'}`}>
          {attachError || UPLOAD_STATE_MESSAGE[uploadState!]}
        </p>
      )}

      <AttachmentsPanel attachments={attachments} onRemove={removeFile} readOnly={readOnly} />

      <DescriptionEditor description={description} onUpdateDescription={onUpdateDescription} readOnly={readOnly} />

      {/* Subtasks Component */}
      <SubtaskList
        subtasks={subtasks}
        taskId={taskId}
        onSubtaskAdded={onSubtaskAdded}
        addTrigger={subtaskAddTrigger}
        readOnly={readOnly}
      />

      {/* Linked Issues (Dependencies) */}
      {(dependencies.length > 0 || showDependencyPicker) && (
        <div className="mb-8 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-cu-border">
            <h3 className="text-sm font-bold text-cu-text-primary tracking-tight font-outfit">Task Dependencies</h3>
            {dependencies.length > 0 && (
              <span className="text-xs text-cu-text-muted bg-cu-bg-secondary px-2 py-0.5 rounded-full font-semibold">{dependencies.length} link{dependencies.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Blocked By List */}
          {dependencies.filter((d) => d.relation === 'BLOCKED_BY').length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-3 rounded-full bg-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 font-sans">Blocked By</h4>
                <span className="text-[10px] text-cu-text-muted bg-amber-500/10 text-amber-600 px-1.5 py-0.2 rounded-full font-bold">
                  {dependencies.filter((d) => d.relation === 'BLOCKED_BY').length}
                </span>
              </div>
              <div className="rounded-xl border border-cu-border bg-cu-bg overflow-hidden divide-y divide-cu-border shadow-sm">
                {dependencies.filter((d) => d.relation === 'BLOCKED_BY').map((dep) => (
                  <div key={dep.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-cu-hover transition-colors group">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-500/10 text-amber-500">
                      BLOCKED BY
                    </span>
                    <Link2 size={13} className="text-cu-text-muted flex-shrink-0" />
                    <button
                      className="text-xs font-bold text-cu-primary hover:underline flex-shrink-0 font-mono"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('taskId', String(dep.id));
                        window.history.pushState({}, '', url.toString());
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                    >
                      TASK-{dep.id}
                    </button>
                    <span className="text-xs text-cu-text-secondary flex-1 min-w-0 truncate font-medium">{dep.title}</span>
                    {dep.status && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        dep.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-cu-bg-tertiary text-cu-text-secondary'
                      }`}>
                        {dep.status}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        if (readOnly) return;
                        if (!taskId) return;
                        try {
                          await api.delete(`/api/tasks/${taskId}/dependencies/${dep.id}`);
                          onDependencyChanged?.();
                        } catch { /* ignore */ }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cu-danger/10 text-cu-text-muted hover:text-cu-danger transition-all"
                      title="Remove blocker"
                      disabled={readOnly}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocking List */}
          {dependencies.filter((d) => d.relation === 'BLOCKS').length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-3 rounded-full bg-blue-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500 font-sans">Blocking</h4>
                <span className="text-[10px] text-cu-text-muted bg-blue-500/10 text-blue-600 px-1.5 py-0.2 rounded-full font-bold">
                  {dependencies.filter((d) => d.relation === 'BLOCKS').length}
                </span>
              </div>
              <div className="rounded-xl border border-cu-border bg-cu-bg overflow-hidden divide-y divide-cu-border shadow-sm">
                {dependencies.filter((d) => d.relation === 'BLOCKS').map((dep) => (
                  <div key={dep.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-cu-hover transition-colors group">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-blue-500/10 text-blue-500">
                      BLOCKS
                    </span>
                    <Link2 size={13} className="text-cu-text-muted flex-shrink-0" />
                    <button
                      className="text-xs font-bold text-cu-primary hover:underline flex-shrink-0 font-mono"
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('taskId', String(dep.id));
                        window.history.pushState({}, '', url.toString());
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                    >
                      TASK-{dep.id}
                    </button>
                    <span className="text-xs text-cu-text-secondary flex-1 min-w-0 truncate font-medium">{dep.title}</span>
                    {dep.status && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        dep.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-cu-bg-tertiary text-cu-text-secondary'
                      }`}>
                        {dep.status}
                      </span>
                    )}
                    <button
                      onClick={async () => {
                        if (readOnly) return;
                        if (!taskId) return;
                        try {
                          await api.delete(`/api/tasks/${dep.id}/dependencies/${taskId}`);
                          onDependencyChanged?.();
                        } catch { /* ignore */ }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-cu-danger/10 text-cu-text-muted hover:text-cu-danger transition-all"
                      title="Remove blocked link"
                      disabled={readOnly}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showDependencyPicker && taskId && projectId && (
            <DependencyPicker
              taskId={taskId}
              projectId={projectId}
              existingDependencyIds={dependencies.map((d) => d.id)}
              onLinked={() => { onDependencyChanged?.(); setShowDependencyPicker(false); }}
              onCancel={() => setShowDependencyPicker(false)}
            />
          )}
        </div>
      )}

      {/* Comments Component */}
      <CommentSection taskId={taskId} projectId={projectId} />
    </div>
  );
};



export default TaskMainContent;
