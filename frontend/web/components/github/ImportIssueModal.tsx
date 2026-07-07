'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { GitBranch, Loader2, X } from 'lucide-react';
import api from '@/lib/axios';
import { type GitHubIssue } from '@/services/github-service';
import { IssueStateBadge } from '@/components/github/IssueStateBadge';

interface ImportIssueModalProps {
  issue: GitHubIssue;
  projectId: string;
  repoFullName: string;
  onSuccess: (taskId: number) => void;
  onClose: () => void;
}

interface ImportIssueResponse {
  imported: number[];
  skipped: number[];
}

function formatBodyPreview(body?: string): string {
  if (!body?.trim()) return 'No description provided.';
  return body.trim().replace(/\n{3,}/g, '\n\n');
}

export function ImportIssueModal({ issue, projectId, repoFullName, onSuccess, onClose }: ImportIssueModalProps) {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const bodyPreview = useMemo(() => formatBodyPreview(issue.body), [issue.body]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handleImport = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await api.post<ImportIssueResponse>('/api/github/issues/import', {
        projectId,
        repoFullName,
        issueNumbers: [issue.number],
      });

      const taskId = response.data.imported?.[0];
      if (typeof taskId !== 'number') {
        throw new Error(
          response.data.skipped?.includes(issue.number)
            ? 'This issue has already been imported or is no longer available.'
            : 'The issue could not be imported.',
        );
      }

      setSuccessMessage('Task created!');
      successTimerRef.current = window.setTimeout(() => {
        onSuccess(taskId);
      }, 700);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
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
              <GitBranch size={16} />
            </div>
            <div>
              <h3 className="text-base font-outfit font-bold text-cu-text-primary">Import as Task</h3>
              <p className="text-xs font-outfit text-cu-text-tertiary">Create a Planora task from this GitHub issue</p>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-outfit font-bold text-cu-text-tertiary">#{issue.number}</span>
                  <IssueStateBadge state={issue.state} size="md" />
                </div>
                <p className="mt-2 text-sm font-outfit font-semibold leading-snug text-cu-text-primary line-clamp-2">
                  {issue.title}
                </p>
              </div>

              {issue.assignees.slice(0, 3).length > 0 && (
                <div className="flex items-center -space-x-2">
                  {issue.assignees.slice(0, 3).map((assignee, index) => {
                    const login = typeof assignee === 'string' ? assignee : assignee.login;
                    const avatarUrl = typeof assignee === 'string' ? null : assignee.avatar_url;

                    return (
                      <div key={`${login}-${index}`} className="relative" title={`@${login}`}>
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={login}
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full border-2 border-cu-bg object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-cu-bg bg-cu-bg-secondary text-[10px] font-outfit font-bold text-cu-text-secondary">
                            {login.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {issue.labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {issue.labels.map(label => (
                  <span
                    key={`${label.name}-${label.color}`}
                    className="rounded-full px-2 py-0.5 text-[10px] font-outfit font-semibold"
                    style={{
                      backgroundColor: `#${label.color}22`,
                      color: `#${label.color}`,
                      border: `1px solid #${label.color}44`,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 rounded-xl border border-cu-border bg-cu-bg p-3">
              <p className="text-[11px] font-outfit font-semibold uppercase tracking-wide text-cu-text-tertiary">Body preview</p>
              <p className="mt-1.5 line-clamp-3 text-sm font-outfit leading-relaxed text-cu-text-secondary">
                {bodyPreview}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {successMessage && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-sm font-outfit font-semibold text-emerald-700 dark:text-emerald-400">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm font-outfit font-semibold text-red-700 dark:text-red-400">
                {errorMessage}
              </div>
            )}
          </div>

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
              onClick={() => void handleImport()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-outfit font-semibold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? 'Importing…' : 'Import Task'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ImportIssueModal;
