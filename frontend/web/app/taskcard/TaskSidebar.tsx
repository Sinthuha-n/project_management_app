'use client';
import React from 'react';
import Link from 'next/link';
import StatusSection from './sidebar/StatusSection';
import AssigneeSection from './sidebar/AssigneeSection';
import MultiAssigneeSection from './sidebar/MultiAssigneeSection';
import MilestoneSection from './sidebar/MilestoneSection';
import PrioritySection from './sidebar/PrioritySection';
import StoryPointSection from './sidebar/StoryPointSection';
import DateSection from './sidebar/DateSection';
import RecurrenceSection from './sidebar/RecurrenceSection';
import TaskGitHubSection from './sidebar/TaskGitHubSection';
import SidebarField from './sidebar/SidebarField';
import CustomFieldsSection from './sidebar/CustomFieldsSection';
import { Check, ChevronDown, Link2, Plus } from 'lucide-react';
import GitHubIssueBadge from '@/components/github/GitHubIssueBadge';
import GitHubMark from '@/components/github/GitHubMark';
import { projectsApi } from '@/services/projects-contract';
import type { ProjectGitHubConnection } from '@/services/github-service';

interface MultiAssignee {
  memberId: number;
  userId: number;
  name: string;
  photoUrl: string | null;
}

interface ProjectCustomField {
  id: number;
  name: string;
  fieldType: string;
  options?: string[];
}

interface TaskSidebarProps {
  taskId?: number;
  projectId?: number;
  taskTitle?: string;
  taskDescription?: string;
  status: string;
  assignee: string | null;
  assigneePhotoUrl?: string | null;
  reporter: string | null;
  reporterId?: number | null;
  labels: string[];
  labelIds?: number[];
  priority: string;
  sprint: string | null;
  sprintId?: number | null;
  storyPoint: number;
  milestoneId?: number | null;
  milestoneName?: string | null;
  githubIssueNumber?: number | null;
  githubRepoFullName?: string | null;
  projectGitHubRepo?: ProjectGitHubConnection | null;
  assignees?: MultiAssignee[];
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  customInterval?: number | null;
  recurrenceLimit?: number | null;
  dates: {
    created: string;
    updated: string;
    dueDate: string | null;
    startDate?: string | null;
  };
  onUpdateStatus?: (status: string) => void;
  onUpdatePriority?: (priority: string) => void;
  onUpdateStoryPoint?: (storyPoint: number) => void;
  onUpdateDueDate?: (dueDate: string | null) => void;
  onUpdateStartDate?: (startDate: string | null) => void;
  onUpdateMilestone?: (milestoneId: number | null) => void;
  onUpdateRecurrence?: (rule: string | null, end: string | null, customInterval: number | null, recurrenceLimit: number | null) => void;
  onUpdateReporter?: (reporterId: number | null) => void;
  onUpdateSprint?: (sprintId: number | null) => void;
  onUpdateLabels?: (labelIds: number[]) => void;
  onUnassign?: () => void;
  onAssigneesChanged?: () => void;
  canEdit?: boolean;
  canChangeReporter?: boolean;
  members?: Array<{ memberId: number; userId: number; name: string; photoUrl?: string | null }>;
  allLabels?: Array<{ id: number; name: string }>;
  sprints?: Array<{ id: number; name: string }>;
  onCreateGitHubIssue?: () => void;
}

const TaskSidebar: React.FC<TaskSidebarProps> = ({
  taskId, projectId, taskTitle, taskDescription, status, assignee, assigneePhotoUrl, reporter, labels, labelIds = [], priority, sprint, storyPoint,
  milestoneId, milestoneName, githubIssueNumber = null, githubRepoFullName = null, projectGitHubRepo = null, assignees,
  recurrenceRule, recurrenceEnd, customInterval, recurrenceLimit, dates, reporterId, sprintId,
  onUpdateStatus, onUpdatePriority, onUpdateStoryPoint, onUpdateDueDate, onUpdateMilestone,
  onUpdateRecurrence, onUnassign, onAssigneesChanged, onUpdateReporter, onUpdateSprint, onUpdateLabels, onUpdateStartDate,
  canEdit = true, canChangeReporter = false, members = [], allLabels = [], sprints = [], onCreateGitHubIssue,
}) => {
  const [sections, setSections] = React.useState<Record<string, boolean>>({
    details: true,
    dates: true,
    github: true,
  });
  const [labelMenuOpen, setLabelMenuOpen] = React.useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<number[]>(labelIds);
  const labelMenuRef = React.useRef<HTMLDivElement>(null);
  const [projectCustomFields, setProjectCustomFields] = React.useState<ProjectCustomField[]>([]);

  React.useEffect(() => {
    if (projectId == null) return;
    let active = true;
    projectsApi.getCustomFields(projectId)
      .then((res) => {
        if (active) {
          setProjectCustomFields(res || []);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [projectId]);

  React.useEffect(() => {
    setSelectedLabelIds((prev) => {
      if (prev.length === labelIds.length && prev.every((id, idx) => id === labelIds[idx])) {
        return prev;
      }
      return labelIds;
    });
  }, [labelIds]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || taskId == null) return;
    const raw = window.localStorage.getItem(`planora:task-sidebar:${taskId}`);
    if (!raw) return;
    try {
      // Restore per-task collapsed/expanded sidebar preferences set in a previous session
      setSections((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<string, boolean>) }));
    } catch {
      // ignore malformed preferences
    }
  }, [taskId]);

  const toggleSection = (key: string) => {
    const next = { ...sections, [key]: !sections[key] };
    setSections(next);
    if (typeof window !== 'undefined' && taskId != null) {
      window.localStorage.setItem(`planora:task-sidebar:${taskId}`, JSON.stringify(next));
    }
  };

  React.useEffect(() => {
    if (!labelMenuOpen) return;
    // Document-level listener rather than onBlur so clicks on other interactive
    // elements also close the label dropdown without requiring focus management.
    const handleOutside = (event: MouseEvent) => {
      if (labelMenuRef.current && !labelMenuRef.current.contains(event.target as Node)) {
        setLabelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [labelMenuOpen]);

  const selectedLabels = allLabels.filter((label) => selectedLabelIds.includes(label.id));
  const connectedRepoFullName = githubRepoFullName || projectGitHubRepo?.repoFullName || null;
  const githubIssueUrl = githubIssueNumber && connectedRepoFullName
    ? `https://github.com/${connectedRepoFullName}/issues/${githubIssueNumber}`
    : null;

  return (
    <div className="w-full md:w-80 bg-cu-bg-secondary border-t md:border-t-0 md:border-l border-cu-border flex-shrink-0 overflow-visible md:overflow-y-auto scrollbar-thin min-h-0">
      <div className="p-4 space-y-4">
      {!canEdit && (
        <div className="rounded-lg border border-cu-warning/20 bg-cu-warning/10 px-3 py-2 text-xs text-cu-warning">
          You have view-only access for this task.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <StatusSection projectId={projectId} status={status} onUpdateStatus={canEdit ? onUpdateStatus : undefined} />
        <PrioritySection priority={priority} onUpdatePriority={canEdit ? onUpdatePriority : undefined} />
      </div>
      <div className="border border-cu-border rounded-xl bg-cu-bg shadow-cu-sm overflow-hidden">
        <button onClick={() => toggleSection('details')} className="w-full px-4 py-2.5 border-b border-cu-border text-[10px] font-bold text-cu-text-muted uppercase tracking-wider flex items-center justify-between">
          Details <ChevronDown size={14} className={`transition-transform ${sections.details ? '' : '-rotate-90'}`} />
        </button>
        {sections.details && <div className="p-4 space-y-4">
          {(!assignees || assignees.length === 0) && (
            <AssigneeSection assignee={assignee} profilePicUrl={assigneePhotoUrl} onUnassign={onUnassign} />
          )}
          {taskId != null && (
            <MultiAssigneeSection
              taskId={taskId}
              projectId={projectId}
              assignees={assignees ?? []}
              onChanged={onAssigneesChanged ?? (() => {})}
              readOnly={!canEdit}
            />
          )}
          <SidebarField label="Reporter">
            <select
              value={reporterId ?? ''}
              onChange={(event) => onUpdateReporter?.(event.target.value ? Number(event.target.value) : null)}
              disabled={!canChangeReporter}
              className="w-full text-sm border border-cu-border rounded-lg px-2.5 h-9 bg-cu-bg text-cu-text-primary disabled:bg-cu-bg-secondary disabled:cursor-not-allowed"
            >
              <option value="">{reporter ?? 'Select reporter'}</option>
              {members.map((member) => (
                <option key={member.memberId} value={member.userId}>{member.name}</option>
              ))}
            </select>
          </SidebarField>
          <SidebarField label="Labels">
            <div className="space-y-2" ref={labelMenuRef}>
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {selectedLabels.length > 0 ? (
                  selectedLabels.map((label) => (
                    <span key={label.id} className="inline-flex items-center gap-1 rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-semibold text-cu-text-secondary">
                      {label.name}
                    </span>
                  ))
                ) : labels.length > 0 ? (
                  labels.map((label) => (
                    <span key={label} className="inline-flex items-center rounded-full border border-cu-border bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-semibold text-cu-text-secondary">
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-cu-text-muted">No labels selected</span>
                )}
              </div>
              {canEdit && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLabelMenuOpen((prev) => !prev)}
                    className="w-full h-9 rounded-xl border border-cu-border bg-cu-bg px-3 text-[12px] font-semibold text-cu-text-primary hover:bg-cu-hover flex items-center justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Plus size={12} />
                      {selectedLabelIds.length > 0 ? `Edit labels (${selectedLabelIds.length})` : 'Add labels'}
                    </span>
                    <ChevronDown size={13} className={`transition-transform ${labelMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {labelMenuOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl p-1">
                      {allLabels.length === 0 ? (
                        <p className="px-2 py-2 text-[12px] text-cu-text-muted">No labels available</p>
                      ) : (
                        allLabels.map((label) => {
                          const active = selectedLabelIds.includes(label.id);
                          return (
                            <button
                              key={label.id}
                              type="button"
                              onClick={() => {
                                const nextIds = active
                                  ? selectedLabelIds.filter((id) => id !== label.id)
                                  : [...selectedLabelIds, label.id];
                                setSelectedLabelIds(nextIds);
                                onUpdateLabels?.(nextIds);
                              }}
                              className="w-full rounded-lg px-2.5 py-2 text-left text-[12px] hover:bg-cu-hover flex items-center justify-between gap-2"
                            >
                              <span className={`${active ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}>{label.name}</span>
                              {active ? <Check size={13} className="text-cu-primary" /> : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SidebarField>
          {projectCustomFields.length > 0 && taskId != null && projectId != null && (
            <CustomFieldsSection
              taskId={taskId}
              projectId={projectId}
              canEdit={canEdit}
            />
          )}
          <SidebarField label="Sprint">
            <select
              value={sprintId ?? ''}
              onChange={(event) => onUpdateSprint?.(event.target.value ? Number(event.target.value) : null)}
              disabled={!canEdit}
              className="w-full text-sm border border-cu-border rounded-lg px-2.5 h-9 bg-cu-bg text-cu-text-primary disabled:bg-cu-bg-secondary"
            >
              <option value="">{sprint ?? 'No sprint'}</option>
              {sprints.map((value) => (
                <option key={value.id} value={value.id}>{value.name}</option>
              ))}
            </select>
          </SidebarField>
          <MilestoneSection
            projectId={projectId}
            milestoneId={milestoneId}
            milestoneName={milestoneName}
            onUpdateMilestone={canEdit ? onUpdateMilestone : undefined}
          />
          <StoryPointSection storyPoint={storyPoint} onUpdateStoryPoint={canEdit ? onUpdateStoryPoint : undefined} />
          {onUpdateRecurrence && (
            <RecurrenceSection
              recurrenceRule={recurrenceRule}
              recurrenceEnd={recurrenceEnd}
              customInterval={customInterval}
              recurrenceLimit={recurrenceLimit}
              onUpdate={canEdit ? onUpdateRecurrence : () => {}}
            />
          )}
        </div>}
      </div>
      <div className="border border-cu-border rounded-xl bg-cu-bg shadow-cu-sm overflow-hidden">
        <button onClick={() => toggleSection('dates')} className="w-full px-4 py-2.5 border-b border-cu-border text-[10px] font-bold text-cu-text-muted uppercase tracking-wider flex items-center justify-between">
          Dates <ChevronDown size={14} className={`transition-transform ${sections.dates ? '' : '-rotate-90'}`} />
        </button>
        {sections.dates && <DateSection dates={dates} onUpdateDueDate={canEdit ? onUpdateDueDate : undefined} onUpdateStartDate={canEdit ? onUpdateStartDate : undefined} />}
      </div>
      {taskId != null && (
        <TaskGitHubSection
          taskId={taskId}
          projectId={projectId}
          taskTitle={taskTitle || `Task #${taskId}`}
          taskDescription={taskDescription}
          taskLabels={labels}
        />
      )}
      <div className="border border-cu-border rounded-xl bg-cu-bg shadow-cu-sm overflow-hidden">
        <button onClick={() => toggleSection('github')} className="w-full px-4 py-2.5 border-b border-cu-border text-[10px] font-bold text-cu-text-muted uppercase tracking-wider flex items-center justify-between">
          GitHub <ChevronDown size={14} className={`transition-transform ${sections.github ? '' : '-rotate-90'}`} />
        </button>
        {sections.github && (
          <div className="p-4 space-y-3">
            {githubIssueNumber ? (
              <div className="space-y-2">
                <GitHubIssueBadge
                  issueNumber={githubIssueNumber}
                  repoFullName={connectedRepoFullName || 'github.com'}
                  size="sm"
                  linkToGitHub={Boolean(githubIssueUrl)}
                />
                {githubIssueUrl && (
                  <Link
                    href={githubIssueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-semibold text-cu-primary hover:underline"
                  >
                    <Link2 size={12} />
                    View on GitHub
                  </Link>
                )}
              </div>
            ) : projectGitHubRepo ? (
              <button
                type="button"
                onClick={onCreateGitHubIssue}
                className="inline-flex items-center gap-2 rounded-xl border border-cu-border bg-cu-bg px-3 py-2 text-sm font-semibold text-cu-text-primary hover:bg-cu-hover transition-colors"
              >
                <GitHubMark size={14} className="text-cu-text-primary" />
                Create GitHub Issue
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-cu-text-secondary">Connect a GitHub repo first</p>
                {projectId != null && (
                  <Link href={`/github/${projectId}`} className="flex items-center gap-1 text-sm font-semibold text-cu-primary hover:underline">
                    <Link2 size={12} />
                    Go to GitHub tab
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="text-[10px] text-cu-text-muted flex justify-between px-1 pb-2">
        <button className="hover:text-cu-text-primary transition-colors">Configure fields</button>
        <button className="hover:text-cu-text-primary transition-colors">Plain Text</button>
      </div>
      </div>
    </div>
  );
};

export default TaskSidebar
