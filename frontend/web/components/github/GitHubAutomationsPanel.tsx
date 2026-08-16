'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  AlertCircle,
  ChevronDown,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  Package,
  ShieldAlert,
  Sparkles,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tags,
} from 'lucide-react';
import GitHubMark from '@/components/github/GitHubMark';
import { type GithubAutomationLog, type GithubAutomationRule, type GithubAutomationTrigger } from '@/services/github-service';

interface GitHubAutomationsPanelProps {
  rules: GithubAutomationRule[];
  logs: GithubAutomationLog[];
  loadingRules: boolean;
  loadingLogs: boolean;
  rulesError: string | null;
  logsError: string | null;
  onCreateRule: () => void;
  onDeleteRule: (ruleId: number) => void;
  onToggleRule: (ruleId: number, enabled: boolean) => void;
  onRefreshRules: () => void;
  onRefreshLogs: () => void;
}

const TRIGGER_STYLES: Record<GithubAutomationTrigger, { label: string; className: string; icon: typeof GitMerge }> = {
  PR_MERGED: { label: 'PR_MERGED', className: 'bg-violet-100 text-violet-700 border-violet-200', icon: GitMerge },
  PR_OPENED: { label: 'PR_OPENED', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: GitPullRequest },
  CI_FAILED: { label: 'CI_FAILED', className: 'bg-red-100 text-red-700 border-red-200', icon: ShieldAlert },
  ISSUE_OPENED: { label: 'ISSUE_OPENED', className: 'bg-sky-100 text-sky-700 border-sky-200', icon: MessageSquare },
  ISSUE_LABELED: { label: 'ISSUE_LABELED', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: Tags },
  RELEASE_PUBLISHED: { label: 'RELEASE_PUBLISHED', className: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Package },
};

const ACTION_STYLES: Record<string, { label: string; className: string }> = {
  MOVE_TASK_TO_COLUMN: { label: 'MOVE_TASK_TO_COLUMN', className: 'bg-slate-900 text-white border-slate-900' },
  CREATE_TASK: { label: 'CREATE_TASK', className: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  SEND_NOTIFICATION: { label: 'SEND_NOTIFICATION', className: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
};

const OUTCOME_STYLES: Record<string, { className: string; label: string }> = {
  SUCCESS: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'SUCCESS' },
  SKIPPED: { className: 'bg-slate-100 text-slate-600 border-slate-200', label: 'SKIPPED' },
  ERROR: { className: 'bg-red-100 text-red-700 border-red-200', label: 'ERROR' },
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function triggerSummary(rule: GithubAutomationRule): string {
  if (rule.action === 'MOVE_TASK_TO_COLUMN') {
    return `→ Move to ${rule.config.targetColumnName || 'target column'}`;
  }

  if (rule.action === 'CREATE_TASK') {
    return `→ Create task${rule.config.taskTitle ? `: ${rule.config.taskTitle}` : ''}`;
  }

  return '→ Send notification';
}

function logIcon(trigger: GithubAutomationTrigger) {
  switch (trigger) {
    case 'PR_MERGED':
      return GitMerge;
    case 'PR_OPENED':
      return GitPullRequest;
    case 'CI_FAILED':
      return ShieldAlert;
    case 'ISSUE_OPENED':
      return MessageSquare;
    case 'ISSUE_LABELED':
      return Tags;
    case 'RELEASE_PUBLISHED':
      return Package;
    default:
      return Sparkles;
  }
}

function EmptyState({ onCreateRule }: { onCreateRule: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-cu-border bg-cu-bg-secondary p-6 text-center sm:p-8">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cu-primary text-white shadow-lg shadow-cu-primary/20">
        <GitHubMark size={34} className="text-white" />
      </div>
      <div className="mx-auto mt-5 max-w-xl">
        <h3 className="text-lg font-semibold text-cu-text-primary">No GitHub automations yet. Add one to automate your workflow.</h3>
        <p className="mt-2 text-sm text-cu-text-secondary">
          Connect GitHub events to task movement, task creation, or notifications for this project.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreateRule}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cu-primary-hover"
      >
        <Sparkles size={15} />
        Add Rule
      </button>
    </div>
  );
}

export default function GitHubAutomationsPanel({
  rules,
  logs,
  loadingRules,
  loadingLogs,
  rulesError,
  logsError,
  onCreateRule,
  onDeleteRule,
  onToggleRule,
  onRefreshRules,
  onRefreshLogs,
}: GitHubAutomationsPanelProps) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<GithubAutomationRule | null>(null);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  return (
    <section className="rounded-3xl border border-cu-border bg-cu-bg p-4 shadow-cu-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cu-bg-secondary text-cu-text-primary shadow-sm">
            <GitHubMark size={20} className="text-cu-text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-cu-text-primary">GitHub Automations</h2>
            <p className="text-sm text-cu-text-secondary">Rules, enablement, and execution logs for this project.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onRefreshRules}
            className="w-full rounded-2xl border border-cu-border bg-cu-bg px-3 py-2 text-sm font-semibold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary sm:w-auto"
          >
            Refresh Rules
          </button>
          <button
            type="button"
            onClick={onCreateRule}
            className="w-full rounded-2xl bg-cu-primary px-3 py-2 text-sm font-semibold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover sm:w-auto"
          >
            + Add Rule
          </button>
        </div>
      </div>

      {rulesError && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{rulesError}</p>
        </div>
      )}

      <div className="mt-5">
        {loadingRules ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-3xl bg-cu-bg-secondary" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState onCreateRule={onCreateRule} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rules.map((rule) => {
              const triggerStyle = TRIGGER_STYLES[rule.trigger];
              const actionStyle = ACTION_STYLES[rule.action];

              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-cu-border bg-cu-bg-secondary p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cu-bg text-cu-text-secondary shadow-sm">
                      <triggerStyle.icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${triggerStyle.className}`}>
                          <triggerStyle.icon size={11} />
                          {triggerStyle.label}
                        </span>
                        <ArrowRight size={14} className="text-cu-text-tertiary" />
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${actionStyle.className}`}>
                          {actionStyle.label}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-cu-text-primary">{triggerSummary(rule)}</p>
                      <p className="mt-1 text-xs text-cu-text-secondary">
                        {rule.enabled ? 'Enabled and actively evaluated.' : 'Disabled and skipped by automation processing.'}
                      </p>
                    </div>
                    <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
                      <button
                        type="button"
                        onClick={() => onToggleRule(rule.id, !rule.enabled)}
                        className={[
                          'inline-flex h-7 w-12 items-center rounded-full border transition-colors',
                          rule.enabled ? 'justify-end border-emerald-200 bg-emerald-500/90 px-1' : 'justify-start border-slate-200 bg-slate-200 px-1',
                        ].join(' ')}
                        aria-label={rule.enabled ? 'Disable automation rule' : 'Enable automation rule'}
                        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
                          {rule.enabled ? <ToggleRight size={13} className="text-emerald-600" /> : <ToggleLeft size={13} className="text-slate-500" />}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRuleToDelete(rule)}
                        className="rounded-xl p-2 text-cu-text-tertiary transition-colors hover:bg-cu-hover hover:text-red-600"
                        aria-label="Delete automation rule"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-3xl border border-cu-border bg-cu-bg">
        <button
          type="button"
          onClick={() => setLogsOpen((current) => !current)}
          className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h3 className="text-sm font-semibold text-cu-text-primary">Recent logs</h3>
            <p className="text-xs text-cu-text-secondary">Last 10 execution events from GitHub automations.</p>
          </div>
          <ChevronDown size={16} className={['text-slate-400 transition-transform', logsOpen ? 'rotate-180' : ''].join(' ')} />
        </button>

        <AnimatePresence initial={false}>
          {logsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-cu-border px-4 py-4">
                {loadingLogs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-2xl bg-cu-bg-secondary" />
                    ))}
                  </div>
                ) : logsError ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>{logsError}</p>
                  </div>
                ) : recentLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-cu-border bg-cu-bg-secondary px-4 py-8 text-center text-sm text-cu-text-secondary">
                    No automation logs yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentLogs.map((log) => {
                      const LogIcon = logIcon(log.trigger);
                      const outcomeStyle = OUTCOME_STYLES[log.outcome] ?? OUTCOME_STYLES.SKIPPED;

                      return (
                        <div key={log.id} className="flex items-start gap-3 rounded-2xl border border-cu-border bg-cu-bg-secondary px-4 py-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cu-bg text-cu-text-secondary shadow-sm">
                            <LogIcon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${outcomeStyle.className}`}>
                                {outcomeStyle.label}
                              </span>
                              <span className="text-xs font-semibold text-cu-text-tertiary">{formatTimestamp(log.executedAt)}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-cu-text-primary">{log.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 flex justify-stretch sm:justify-end">
                  <button
                    type="button"
                    onClick={onRefreshLogs}
                    className="w-full rounded-2xl border border-cu-border bg-cu-bg px-3 py-2 text-sm font-semibold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary sm:w-auto"
                  >
                    Refresh Logs
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {ruleToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRuleToDelete(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-cu-border bg-cu-bg p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10">
                  <Trash2 size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-cu-text-primary font-outfit">
                    Delete Automation Rule
                  </h3>
                  <p className="mt-1 text-xs text-cu-text-secondary font-outfit leading-relaxed">
                    Are you sure you want to delete this automation rule? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-cu-border bg-cu-bg-secondary p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TRIGGER_STYLES[ruleToDelete.trigger]?.className || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {TRIGGER_STYLES[ruleToDelete.trigger]?.label || ruleToDelete.trigger}
                  </span>
                  <ArrowRight size={12} className="text-cu-text-tertiary" />
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_STYLES[ruleToDelete.action]?.className || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {ACTION_STYLES[ruleToDelete.action]?.label || ruleToDelete.action}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-cu-text-primary font-outfit">
                  {triggerSummary(ruleToDelete)}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRuleToDelete(null)}
                  className="rounded-xl border border-cu-border bg-cu-bg px-4 py-2 text-xs font-semibold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary font-outfit"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteRule(ruleToDelete.id);
                    setRuleToDelete(null);
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 font-outfit flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Delete Rule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
