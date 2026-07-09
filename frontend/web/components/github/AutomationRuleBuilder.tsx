'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleDot,
  GitMerge,
  GitPullRequest,
  Loader2,
  MessageSquare,
  MoveRight,
  Package,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import Button from '@/components/shared/Button';
import { fetchKanbanBoard } from '@/app/(project)/kanban/api';
import {
  createGitHubAutomationRule,
  type GithubAutomationAction,
  type GithubAutomationRule,
  type GithubAutomationTrigger,
} from '@/services/github-service';

interface AutomationRuleBuilderProps {
  projectId: string;
  onCreated: (rule: GithubAutomationRule) => void;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

type TriggerOption = {
  value: GithubAutomationTrigger;
  label: string;
  description: string;
  icon: typeof GitMerge;
};

type ActionOption = {
  value: GithubAutomationAction;
  label: string;
  description: string;
  icon: typeof Target;
};

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: 'PR_MERGED',
    label: 'Pull request merged',
    description: 'Run the rule when a pull request is merged.',
    icon: GitMerge,
  },
  {
    value: 'PR_OPENED',
    label: 'Pull request opened',
    description: 'Run the rule when a new pull request is opened.',
    icon: GitPullRequest,
  },
  {
    value: 'CI_FAILED',
    label: 'CI failed',
    description: 'Run the rule when a workflow or build fails.',
    icon: ShieldAlert,
  },
  {
    value: 'ISSUE_OPENED',
    label: 'Issue opened',
    description: 'Run the rule when a new issue is created.',
    icon: MessageSquare,
  },
  {
    value: 'ISSUE_LABELED',
    label: 'Issue labeled',
    description: 'Run the rule when an issue receives a specific label.',
    icon: CircleDot,
  },
  {
    value: 'RELEASE_PUBLISHED',
    label: 'Release published',
    description: 'Run the rule when a release is published.',
    icon: Package,
  },
];

const ACTION_OPTIONS: ActionOption[] = [
  {
    value: 'MOVE_TASK_TO_COLUMN',
    label: 'Move task to column',
    description: 'Move the linked task to a Kanban column.',
    icon: MoveRight,
  },
  {
    value: 'CREATE_TASK',
    label: 'Create task',
    description: 'Create a new task from the event context.',
    icon: PlusCircle,
  },
  {
    value: 'SEND_NOTIFICATION',
    label: 'Send notification',
    description: 'Send a notification to the team.',
    icon: BellRing,
  },
];

const ACTIONS_BY_TRIGGER: Record<GithubAutomationTrigger, GithubAutomationAction[]> = {
  PR_MERGED: ['MOVE_TASK_TO_COLUMN', 'SEND_NOTIFICATION'],
  PR_OPENED: ['MOVE_TASK_TO_COLUMN', 'SEND_NOTIFICATION'],
  CI_FAILED: ['CREATE_TASK', 'SEND_NOTIFICATION'],
  ISSUE_OPENED: ['CREATE_TASK', 'SEND_NOTIFICATION'],
  ISSUE_LABELED: ['MOVE_TASK_TO_COLUMN', 'SEND_NOTIFICATION'],
  RELEASE_PUBLISHED: ['MOVE_TASK_TO_COLUMN', 'SEND_NOTIFICATION'],
};

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

function StepBadge({ step, active, complete }: { step: Step; active: boolean; complete: boolean }) {
  return (
    <div
      className={[
        'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
        complete
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : active
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-400',
      ].join(' ')}
    >
      {complete ? <CheckCircle2 size={16} /> : step}
    </div>
  );
}

function RuleCardButton({
  option,
  selected,
  disabled,
  onClick,
}: {
  option: TriggerOption | ActionOption;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all',
        selected
          ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
        disabled ? 'cursor-not-allowed opacity-45 hover:bg-white' : '',
      ].join(' ')}
    >
      <div
        className={[
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          selected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200',
        ].join(' ')}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{option.label}</h3>
          {selected && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Selected</span>}
        </div>
        <p className={['mt-1 text-xs leading-5', selected ? 'text-slate-200' : 'text-slate-500'].join(' ')}>{option.description}</p>
      </div>
    </button>
  );
}

export default function AutomationRuleBuilder({ projectId, onCreated, onClose }: AutomationRuleBuilderProps) {
  const [step, setStep] = useState<Step>(1);
  const [trigger, setTrigger] = useState<GithubAutomationTrigger>('PR_MERGED');
  const [action, setAction] = useState<GithubAutomationAction>('MOVE_TASK_TO_COLUMN');
  const [columns, setColumns] = useState<Array<{ id: number; title: string }>>([]);
  const [loadingColumns, setLoadingColumns] = useState(true);
  const [columnError, setColumnError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [columnName, setColumnName] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('HIGH');
  const [taskLabelName, setTaskLabelName] = useState('');
  const [labelFilterName, setLabelFilterName] = useState('');

  const allowedActions = ACTIONS_BY_TRIGGER[trigger];
  const triggerOption = TRIGGER_OPTIONS.find((item) => item.value === trigger);
  const actionOption = ACTION_OPTIONS.find((item) => item.value === action);
  const selectedColumns = useMemo(() => columns.map((column) => ({ value: column.title, label: column.title })), [columns]);

  useEffect(() => {
    let active = true;

    async function loadColumns() {
      if (action !== 'MOVE_TASK_TO_COLUMN') {
        setColumns([]);
        setColumnError(null);
        setLoadingColumns(false);
        return;
      }

      setLoadingColumns(true);
      setColumnError(null);

      try {
        const board = await fetchKanbanBoard(Number(projectId));
        if (!active) return;

        setColumns(board?.columns || []);
      } catch (error) {
        if (!active) return;
        console.error('Failed to load kanban columns for automation rules:', error);
        setColumnError('Unable to load Kanban columns. Task-move rules will stay disabled until the board is available.');
      } finally {
        if (active) {
          setLoadingColumns(false);
        }
      }
    }

    void loadColumns();

    return () => {
      active = false;
    };
  }, [action, projectId]);

  useEffect(() => {
    if (!allowedActions.includes(action)) {
      setAction(allowedActions[0]);
    }
  }, [allowedActions, action]);

  useEffect(() => {
    if (action === 'MOVE_TASK_TO_COLUMN' && columns.length === 0 && !loadingColumns) {
      void (async () => {
        setLoadingColumns(true);
        setColumnError(null);

        try {
          const board = await fetchKanbanBoard(Number(projectId));
          setColumns(board?.columns || []);
        } catch (error) {
          console.error('Failed to load kanban columns for automation rules:', error);
          setColumnError('Unable to load Kanban columns. Task-move rules will stay disabled until the board is available.');
        } finally {
          setLoadingColumns(false);
        }
      })();
    }
  }, [action, columns.length, loadingColumns, projectId]);

  useEffect(() => {
    if (trigger === 'CI_FAILED' && action === 'CREATE_TASK' && !taskTitle) {
      setTaskTitle('CI failed: {workflowName} on {branch}');
    }

    if (trigger === 'ISSUE_OPENED' && action === 'CREATE_TASK' && !taskTitle) {
      setTaskTitle('Issue: {issueTitle}');
    }
  }, [action, taskTitle, trigger]);

  useEffect(() => {
    if (action !== 'MOVE_TASK_TO_COLUMN') {
      return;
    }

    if (!columnName && columns.length > 0) {
      setColumnName(columns[0].title);
    }
  }, [action, columnName, columns]);

  const canMoveTask = action === 'MOVE_TASK_TO_COLUMN';
  const canCreateTask = action === 'CREATE_TASK';
  const needsLabelTrigger = trigger === 'ISSUE_LABELED';
  const needsIssueLabelFilter = trigger === 'ISSUE_OPENED' && action === 'CREATE_TASK';

  async function handleSubmit() {
    setSubmitError(null);

    if (canMoveTask && !columnName) {
      setSubmitError('Choose a target column before creating the rule.');
      return;
    }

    if (canMoveTask && columns.length === 0) {
      setSubmitError('No Kanban columns are available yet. Create the board before adding a move rule.');
      return;
    }

    if (needsLabelTrigger && !labelFilterName.trim()) {
      setSubmitError('Enter the label that should trigger this rule.');
      return;
    }

    if (needsIssueLabelFilter && !labelFilterName.trim()) {
      setSubmitError('Enter the issue label filter for this rule.');
      return;
    }

    const config: Record<string, string> = {
      projectId,
    };

    if (canMoveTask) {
      config.targetColumnName = columnName;
    }

    if (canCreateTask) {
      if (taskTitle.trim()) {
        config.taskTitle = taskTitle.trim();
      }
      config.priority = taskPriority;
      if (taskLabelName.trim()) {
        config.labelName = taskLabelName.trim();
      }
    }

    if (needsLabelTrigger || needsIssueLabelFilter) {
      config.labelName = labelFilterName.trim();
    }

    setSubmitting(true);

    try {
      const created = await createGitHubAutomationRule(projectId, {
        trigger,
        action,
        config,
      });
      onCreated(created);
      onClose();
    } catch (error) {
      console.error('Failed to create GitHub automation rule:', error);
      setSubmitError('Unable to create the automation rule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title="Create GitHub automation rule"
      description="Build a project automation from a GitHub trigger, action, and optional task configuration."
      size="xl"
      className="overflow-hidden"
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {([1, 2, 3] as Step[]).map((item, index) => (
              <div key={item} className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge step={item} active={step === item} complete={step > item} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Step {item}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {item === 1 ? 'Pick trigger' : item === 2 ? 'Pick action' : 'Configure rule'}
                    </p>
                  </div>
                </div>
                {index < 2 && <ArrowRight size={15} className="text-slate-300" />}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Trigger</h3>
                <p className="mt-1 text-xs text-slate-500">Choose the GitHub event that should start this rule.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {TRIGGER_OPTIONS.map((option) => (
                  <RuleCardButton
                    key={option.value}
                    option={option}
                    selected={trigger === option.value}
                    onClick={() => {
                      setTrigger(option.value);
                      setStep(2);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Action</h3>
                  <p className="mt-1 text-xs text-slate-500">Only the actions that work with the selected trigger are enabled.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Back to trigger
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ACTION_OPTIONS.map((option) => {
                  const isAllowed = allowedActions.includes(option.value);
                  return (
                    <RuleCardButton
                      key={option.value}
                      option={option}
                      selected={action === option.value}
                      disabled={!isAllowed}
                      onClick={() => {
                        if (!isAllowed) {
                          return;
                        }
                        setAction(option.value);
                        setStep(3);
                      }}
                    />
                  );
                })}
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <strong>Allowed for {triggerOption?.label}:</strong> {allowedActions.map((value) => ACTION_OPTIONS.find((item) => item.value === value)?.label).filter(Boolean).join(', ')}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Configure the rule</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {triggerOption?.label} → {actionOption?.label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Back to actions
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Target size={16} className="text-slate-500" />
                    Rule summary
                  </div>
                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                      <Sparkles size={16} className="mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Trigger</p>
                        <p className="text-xs text-slate-500">{triggerOption?.label}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                      <ArrowRight size={16} className="mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Action</p>
                        <p className="text-xs text-slate-500">{actionOption?.label}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                      <AlertCircle size={16} className="mt-0.5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-slate-900">Project binding</p>
                        <p className="text-xs text-slate-500">This rule will be saved for project {projectId} and used by the backend automation runner.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  {columnError && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <p>{columnError}</p>
                    </div>
                  )}

                  {submitError && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <p>{submitError}</p>
                    </div>
                  )}

                  {canMoveTask && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-900">Target column</label>
                      <Select
                        value={columnName}
                        onChange={(event) => setColumnName(event.target.value)}
                        options={selectedColumns}
                        placeholder={loadingColumns ? 'Loading columns...' : 'Select a Kanban column'}
                        disabled={loadingColumns || columns.length === 0}
                      />
                      <p className="text-xs text-slate-500">
                        {columns.length > 0 ? 'The task will move to the selected column.' : 'No columns are available yet for this project.'}
                      </p>
                    </div>
                  )}

                  {canCreateTask && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-900">Task title template</label>
                        <input
                          value={taskTitle}
                          onChange={(event) => setTaskTitle(event.target.value)}
                          placeholder="CI failed: {workflowName} on {branch}"
                          className="w-full rounded-cu-md border border-cu-border bg-cu-bg px-3 py-2 text-sm text-cu-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cu-purple"
                        />
                        <p className="text-xs text-slate-500">You can use literal template text here; the backend will store it as the task title.</p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-900">Priority</label>
                          <Select
                            value={taskPriority}
                            onChange={(event) => setTaskPriority(event.target.value)}
                            options={PRIORITY_OPTIONS}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-900">Task label</label>
                          <input
                            value={taskLabelName}
                            onChange={(event) => setTaskLabelName(event.target.value)}
                            placeholder="bug"
                            className="w-full rounded-cu-md border border-cu-border bg-cu-bg px-3 py-2 text-sm text-cu-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cu-purple"
                          />
                          <p className="text-xs text-slate-500">Optional. If empty, the backend uses its default label behavior.</p>
                        </div>
                      </div>
                    </>
                  )}

                  {needsLabelTrigger && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-900">React when label is</label>
                      <input
                        value={labelFilterName}
                        onChange={(event) => setLabelFilterName(event.target.value)}
                        placeholder="priority:high"
                        className="w-full rounded-cu-md border border-cu-border bg-cu-bg px-3 py-2 text-sm text-cu-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cu-purple"
                      />
                      <p className="text-xs text-slate-500">The rule will only run when an issue receives this label.</p>
                    </div>
                  )}

                  {needsIssueLabelFilter && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-900">Only when issue has label</label>
                      <input
                        value={labelFilterName}
                        onChange={(event) => setLabelFilterName(event.target.value)}
                        placeholder="needs-triage"
                        className="w-full rounded-cu-md border border-cu-border bg-cu-bg px-3 py-2 text-sm text-cu-text-primary focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cu-purple"
                      />
                      <p className="text-xs text-slate-500">Leave empty to run on every opened issue.</p>
                    </div>
                  )}

                  {!canMoveTask && !canCreateTask && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                      This action does not require any extra configuration.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {loadingColumns ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading Kanban metadata...
              </span>
            ) : (
              <span>{columns.length} Kanban columns loaded for this project.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep((current) => ((current - 1) as Step))} type="button">
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep((current) => ((current + 1) as Step))}
                type="button"
                leftIcon={<ArrowRight size={14} />}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} type="button" isLoading={submitting} leftIcon={<CheckCircle2 size={14} />}>
                Create rule
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
