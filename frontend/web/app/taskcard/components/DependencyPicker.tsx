'use client';
import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';

interface ProjectTask {
  id: number;
  title: string;
}

interface DependencyPickerProps {
  taskId: number;
  projectId: number;
  existingDependencyIds: number[];
  onLinked: () => void;
  onCancel: () => void;
}

const DependencyPicker: React.FC<DependencyPickerProps> = ({
  taskId,
  projectId,
  existingDependencyIds,
  onLinked,
  onCancel,
}) => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      void api.get<ProjectTask[]>(`/api/tasks/project/${projectId}/all`)
        .then((r) => setTasks(r.data))
        .catch(() => setTasks([]))
        .finally(() => setLoading(false));
    });
  }, [projectId]);

  // Exclude the task itself and already-linked tasks so the picker only shows valid new targets
  const filtered = tasks.filter(
    (t) =>
      t.id !== taskId &&
      !existingDependencyIds.includes(t.id) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = async (blocker: ProjectTask) => {
    setLinking(true);
    try {
      await api.post(`/api/tasks/${taskId}/dependencies/${blocker.id}`);
      onLinked();
    } catch {
      // 409 Conflict means the dependency already exists — safe to ignore and still call onLinked
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="border border-cu-primary/20 rounded-xl p-3 bg-cu-primary/5">
      <input
        autoFocus
        type="text"
        placeholder="Search tasks to link..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-cu-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/20 bg-cu-bg text-cu-text-primary mb-2"
      />
      {loading && <p className="text-xs text-cu-text-muted px-1">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-xs text-cu-text-muted px-1">No matching tasks found</p>
      )}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => !linking && void handleSelect(t)}
            disabled={linking}
            className="w-full text-left px-3 py-2 rounded-xl hover:bg-cu-bg text-sm text-cu-text-primary transition-colors flex items-center gap-2 border border-transparent hover:border-cu-border"
          >
            <span className="text-xs text-cu-text-muted shrink-0">TASK-{t.id}</span>
            <span className="truncate">{t.title}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="mt-2 text-xs text-cu-text-secondary hover:text-cu-text-primary underline"
      >
        Cancel
      </button>
    </div>
  );
};

export default DependencyPicker;
