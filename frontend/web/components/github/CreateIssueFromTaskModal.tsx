'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import api from '@/lib/axios';
import { normalizeApiError } from '@/lib/api-error';
import { toast } from '@/components/ui';
import OverlayPortal from '@/components/ui/OverlayPortal';
import GitHubMark from '@/components/github/GitHubMark';
import type { GitHubIssue } from '@/services/github-service';

interface CreateIssueFromTaskModalProps {
  open: boolean;
  taskId?: number;
  taskTitle: string;
  taskDescription?: string;
  taskLabels: string[];
  repoFullName: string;
  onClose: () => void;
  onCreated: (issue: GitHubIssue) => void;
}

function normalizeLabel(label: string): string {
  return label.trim();
}

export default function CreateIssueFromTaskModal({
  open,
  taskId,
  taskTitle,
  taskDescription,
  taskLabels,
  repoFullName,
  onClose,
  onCreated,
}: CreateIssueFromTaskModalProps) {
  const [title, setTitle] = useState(taskTitle);
  const [body, setBody] = useState(taskDescription ?? '');
  const [labels, setLabels] = useState<string[]>(taskLabels);
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(taskTitle);
    setBody(taskDescription ?? '');
    setLabels(taskLabels.map(normalizeLabel).filter(Boolean));
    setLabelInput('');
    setError(null);
  }, [open, taskTitle, taskDescription, taskLabels]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  const addLabel = () => {
    const next = normalizeLabel(labelInput);
    if (!next) return;
    setLabels((current) => (
      current.some((label) => label.toLowerCase() === next.toLowerCase())
        ? current
        : [...current, next]
    ));
    setLabelInput('');
  };

  const removeLabel = (labelToRemove: string) => {
    setLabels((current) => current.filter((label) => label.toLowerCase() !== labelToRemove.toLowerCase()));
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Issue title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post<GitHubIssue>('/api/github/issues/create', {
        repoFullName,
        title: trimmedTitle,
        body: body.trim() || undefined,
        labels,
        assignees: [],
        taskId,
      });

      onCreated(data);
      toast(`GitHub issue #${data.number} created`, 'success');
      onClose();
    } catch (requestError) {
      setError(normalizeApiError(requestError, 'Failed to create GitHub issue'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <OverlayPortal>
      <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--cu-z-modal-popover)] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-cu-bg border border-cu-border shadow-cu-xl"
      >
        <div className="flex items-center justify-between border-b border-cu-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-800 text-white shadow-sm">
              <GitHubMark size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-outfit font-bold text-cu-text-primary">Create GitHub Issue</h3>
              <p className="text-xs font-outfit text-cu-text-tertiary">Create a GitHub issue from this task</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-cu-border bg-cu-bg-secondary p-4 shadow-cu-sm">
            <p className="text-xs font-outfit font-bold uppercase tracking-wide text-cu-text-tertiary">Repository</p>
            <p className="mt-1 text-sm font-outfit font-semibold text-cu-text-primary">{repoFullName}</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-outfit font-bold uppercase tracking-wide text-cu-text-tertiary">Issue title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-sm font-outfit text-cu-text-primary outline-none transition-colors placeholder:text-cu-text-muted focus:border-cu-primary/40 focus:ring-1 focus:ring-cu-primary/30"
              placeholder="Issue title"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-outfit font-bold uppercase tracking-wide text-cu-text-tertiary">Body</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="w-full rounded-xl border border-cu-border bg-cu-bg px-4 py-3 text-sm font-outfit text-cu-text-primary outline-none transition-colors placeholder:text-cu-text-muted focus:border-cu-primary/40 focus:ring-1 focus:ring-cu-primary/30"
              placeholder="Issue description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-outfit font-bold uppercase tracking-wide text-cu-text-tertiary">Labels</label>
            <div className="rounded-xl border border-cu-border bg-cu-bg px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-cu-border bg-cu-bg-secondary px-2.5 py-1 text-xs font-outfit font-semibold text-cu-text-secondary"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => removeLabel(label)}
                      className="rounded-full text-cu-text-tertiary transition-colors hover:text-cu-text-primary"
                      aria-label={`Remove label ${label}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={labelInput}
                  onChange={(event) => setLabelInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addLabel();
                    }
                    if (event.key === 'Backspace' && !labelInput && labels.length > 0) {
                      removeLabel(labels[labels.length - 1]);
                    }
                  }}
                  onBlur={addLabel}
                  placeholder={labels.length > 0 ? 'Add another label' : 'Add labels'}
                  className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-outfit text-cu-text-primary outline-none placeholder:text-cu-text-muted"
                />
              </div>
            </div>
            <p className="text-xs font-outfit text-cu-text-tertiary">Press Enter or comma to add a label.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm font-outfit font-semibold text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-cu-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-cu-border px-4 py-2.5 text-sm font-outfit font-semibold text-cu-text-secondary transition-colors hover:bg-cu-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading || title.trim().length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-outfit font-semibold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Creating…' : 'Create Issue'}
            </button>
          </div>
        </div>
      </motion.div>
      </motion.div>
    </OverlayPortal>
  );
}
