"use client";
import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Square, Plus, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';

interface Subtask {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string | null;
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH:   'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  NORMAL: 'bg-blue-400',
  LOW:    'bg-gray-300',
};

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface SubtaskListProps {
  subtasks: Subtask[];
  taskId?: number;
  onSubtaskAdded?: (subtask: Subtask) => void;
  addTrigger?: number;
  readOnly?: boolean;
}

const SubtaskList: React.FC<SubtaskListProps> = ({ subtasks: initialSubtasks, taskId, onSubtaskAdded, addTrigger, readOnly = false }) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when parent subtasks change (e.g. after parent re-fetch)
  useEffect(() => {
    setSubtasks(initialSubtasks);
  }, [initialSubtasks]);

  // Respond to addTrigger from parent (ActionButton click)
  useEffect(() => {
    if (!readOnly && addTrigger && addTrigger > 0) {
      setIsAdding(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [addTrigger, readOnly]);

  const completedCount = subtasks.filter(t => t.status?.toUpperCase() === 'DONE').length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  const handleAddSubtask = async () => {
    if (!newTitle.trim() || !taskId) return;
    try {
      setSaving(true);
      const res = await api.post(`/api/tasks/${taskId}/subtasks`, { title: newTitle.trim(), status: 'TODO' });
      setSubtasks(prev => [...prev, res.data]);
      setNewTitle('');
      setIsAdding(false);
      onSubtaskAdded?.(res.data);
    } catch {
      // keep input open on error
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (st: Subtask) => {
    if (readOnly) return;
    const isDone = st.status?.toUpperCase() === 'DONE';
    const newStatus = isDone ? 'TODO' : 'DONE';
    setToggleLoading(st.id);
    // Optimistic update makes the checkbox feel instant; revert to original status if the API rejects it
    setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, status: newStatus } : s));
    try {
      await api.patch(`/api/tasks/${st.id}/status`, { status: newStatus });
    } catch {
      // revert
      setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, status: st.status } : s));
      // offer retry
      toast('Failed to update subtask status', 'error', 8000, 'Retry', async () => {
        setToggleLoading(st.id);
        try {
          await api.patch(`/api/tasks/${st.id}/status`, { status: newStatus });
        } catch {
          toast('Retry failed', 'error');
        } finally {
          setToggleLoading(null);
        }
      });
    } finally {
      setToggleLoading(null);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-cu-text-primary">Subtasks</h3>
        <div className="flex items-center gap-3">
          {subtasks.length > 0 && (
            <>
              <span className="text-xs text-cu-text-muted">{completedCount} of {subtasks.length} done</span>
              <div className="w-24 h-1.5 bg-cu-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-cu-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}
          {taskId && !readOnly && (
            <button
              onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-1 text-xs font-semibold text-cu-primary hover:text-cu-primary-hover transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {subtasks.map((st) => {
          const isDone = st.status?.toUpperCase() === 'DONE';
          return (
            <div
              key={st.id}
              className={`flex items-center gap-3 p-2.5 rounded-xl group border border-cu-border transition-colors ${readOnly ? 'cursor-default bg-cu-bg' : 'cursor-pointer hover:bg-cu-hover hover:border-cu-primary/30'}`}
              onClick={() => handleToggle(st)}
            >
              {toggleLoading === st.id ? (
                <Loader2 size={16} className="text-cu-primary animate-spin flex-shrink-0" />
              ) : isDone ? (
                <CheckSquare size={16} className="text-cu-success flex-shrink-0" />
              ) : (
                <Square size={16} className="text-cu-text-muted flex-shrink-0" />
              )}
              <span className={`text-xs font-medium flex-shrink-0 ${isDone ? 'text-cu-text-muted' : 'text-cu-text-secondary'}`}>
                TASK-{st.id}
              </span>
              <span className={`text-sm flex-1 min-w-0 ${isDone ? 'text-cu-text-muted line-through' : 'text-cu-text-primary'}`}>
                {st.title}
              </span>
              {st.priority && (
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[st.priority] ?? 'bg-gray-300'}`}
                  title={st.priority}
                />
              )}
              {st.dueDate && (
                <span className="text-xs text-cu-text-secondary flex-shrink-0">{fmtDate(st.dueDate)}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                isDone ? 'bg-cu-success/10 text-cu-success' : 'bg-cu-bg-secondary text-cu-text-secondary'
              }`}>
                {st.status}
              </span>
            </div>
          );
        })}

        {subtasks.length === 0 && !isAdding && (
          <p className="text-sm text-cu-text-muted pl-1">No subtasks yet</p>
        )}

        {isAdding && !readOnly && (
          <div className="flex items-center gap-2 p-2.5 border border-cu-primary/20 rounded-xl bg-cu-primary/5">
            <Square size={16} className="text-cu-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddSubtask();
                if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
              }}
              placeholder="Subtask title..."
              className="flex-1 text-sm bg-transparent outline-none text-cu-text-primary placeholder:text-cu-text-muted"
              disabled={saving}
            />
            <button
              onClick={() => void handleAddSubtask()}
              disabled={!newTitle.trim() || saving}
              className="px-2.5 py-1.5 text-xs bg-cu-primary text-white rounded-lg hover:bg-cu-primary-hover disabled:opacity-40 transition-colors flex items-center gap-1 font-semibold"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Save
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewTitle(''); }}
              className="px-2.5 py-1.5 text-xs bg-cu-bg-secondary text-cu-text-primary rounded-lg hover:bg-cu-bg-tertiary transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        )}

        {!isAdding && taskId && subtasks.length > 0 && !readOnly && (
          <button
            onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="mt-1 text-sm text-cu-primary hover:text-cu-primary-hover pl-2 flex items-center gap-1 transition-colors font-medium"
          >
            <Plus size={13} /> Add subtask
          </button>
        )}
      </div>
    </div>
  );
};

export default SubtaskList;
