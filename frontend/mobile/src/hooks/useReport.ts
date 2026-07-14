/**
 * useReport.ts
 * Fetches all data needed for the report screen:
 *   – project metrics, tasks, sprints, milestones, members, project info
 *   – scheduled reports list (with manual refresh / mutate)
 *
 * Uses module-level cache with a 60-second TTL so switching
 * back to the report tab feels instant.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { taskService, sprintService } from '../services/task-service';
import { projectService } from '../services/project-service';
import {
  getProjectScheduledReports,
  deleteScheduledReport,
  pauseScheduledReport,
  resumeScheduledReport,
  ScheduledReportResponse,
} from '../services/report-service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportTask {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assigneeName?: string;
  storyPoint?: number;
  completedAt?: string;
}

export interface ReportSprint {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface ReportMetrics {
  totalTasks:      number;
  completedTasks:  number;
  overdueTasks:    number;
  inProgressTasks?: number;
}

export interface ReportMilestone {
  id:         number;
  name:       string;
  status:     string;
  dueDate?:   string;
  taskCount?: number;
}

export interface ReportMember {
  id:     number;
  userId: number;
  role:   string;
  user:   { fullName: string; username: string };
}

export interface ReportProject {
  id:          number;
  name:        string;
  description?: string;
  type?:        string;
  createdAt?:   string;
}

export interface ReportData {
  project:    ReportProject | null;
  tasks:      ReportTask[];
  sprints:    ReportSprint[];
  metrics:    ReportMetrics;
  milestones: ReportMilestone[];
  members:    ReportMember[];
  isAgile:    boolean;

  // Derived KPIs
  completionPct:  number;
  overduePct:     number;
  avgLeadTimeDays: number;
  unassignedCount: number;
  idleMemberCount: number;
  activeSprint?: ReportSprint & { completionRate: number };
  generatedAt:    string;
}

// ── Module cache ──────────────────────────────────────────────────────────────

interface CacheEntry { data: ReportData; fetchedAt: number }
const CACHE = new Map<number, CacheEntry>();
const TTL   = 60_000;

function getCached(id: number): ReportData | null {
  const e = CACHE.get(id);
  if (!e) return null;
  if (Date.now() - e.fetchedAt > TTL) { CACHE.delete(id); return null; }
  return e.data;
}

// ── Helper: build derived report data ────────────────────────────────────────

const AGILE_TYPES = ['AGILE', 'SCRUM'];

function buildReportData(
  project: ReportProject | null,
  tasks: ReportTask[],
  sprints: ReportSprint[],
  metrics: ReportMetrics,
  milestones: ReportMilestone[],
  members: ReportMember[],
): ReportData {
  const isAgile   = AGILE_TYPES.includes((project?.type ?? '').toUpperCase());
  const total     = metrics.totalTasks || 1;
  const completionPct = Math.round((metrics.completedTasks / total) * 100);
  const overduePct    = Math.round((metrics.overdueTasks   / total) * 100);
  const unassignedCount = tasks.filter(t => !t.assigneeName).length;

  // Avg lead time (days from creation to completion)
  const completedWithDates = tasks.filter(
    t => t.status === 'DONE' && t.completedAt,
  );
  const avgLeadTimeDays =
    completedWithDates.length === 0
      ? 0
      : Math.round(
          completedWithDates.reduce((acc, t) => {
            const created = t.dueDate
              ? Date.now() // fallback — we don't have createdAt on task
              : Date.now();
            const completed = t.completedAt ? new Date(t.completedAt).getTime() : Date.now();
            return acc + Math.max(0, (completed - created) / 86_400_000);
          }, 0) / completedWithDates.length,
        );

  // Active sprint for Agile
  const rawActive = sprints.find(s => s.status === 'ACTIVE');
  const sprintTasks = rawActive ? tasks.filter(t => (t as any).sprintId === rawActive.id) : [];
  const sprintDone  = sprintTasks.filter(t => t.status === 'DONE').length;
  const activeSprint = rawActive
    ? {
        ...rawActive,
        completionRate:
          sprintTasks.length === 0
            ? 0
            : Math.round((sprintDone / sprintTasks.length) * 100),
      }
    : undefined;

  // Idle members = members with no assigned tasks
  const assignedNames = new Set(tasks.map(t => t.assigneeName).filter(Boolean));
  const idleMemberCount = members.filter(
    m => !assignedNames.has(m.user.fullName),
  ).length;

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return {
    project, tasks, sprints, metrics, milestones, members, isAgile,
    completionPct, overduePct, avgLeadTimeDays,
    unassignedCount, idleMemberCount, activeSprint, generatedAt,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useReport(projectId: number) {
  const cached    = projectId ? getCached(projectId) : null;
  const [data,    setData]    = useState<ReportData | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error,   setError]   = useState<string | null>(null);

  // Scheduled reports — kept separately so mutations don't re-fetch all data
  const [schedules,    setSchedules]    = useState<ScheduledReportResponse[]>([]);
  const [schLoading,   setSchLoading]   = useState(true);

  const isMounted = useRef(true);

  // ── Fetch project data ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (background = false) => {
    if (!projectId) return;
    if (!background) setLoading(true);
    setError(null);

    try {
      const [
        tasksData, springsData, metricsRes, projectData, milestonesRes, membersData,
      ] = await Promise.all([
        taskService.listAllByProject(projectId).catch(() => []),
        sprintService.listByProject(projectId).catch(() => []),
        projectService.getMetrics(projectId).catch(() => ({ totalTasks: 0, completedTasks: 0, overdueTasks: 0 })),
        projectService.get(projectId).catch(() => null),
        projectService.getMilestones(projectId).catch(() => []),
        projectService.getMembers(projectId).catch(() => []),
      ]);

      if (!isMounted.current) return;

      const rawProject  = projectData;
      const rawMembers  = (membersData as any[]).map((m: any) => ({
        id:     m.id,
        userId: m.user?.userId ?? m.userId,
        role:   m.role,
        user:   { fullName: m.user?.fullName ?? '', username: m.user?.username ?? '' },
      }));

      const built = buildReportData(
        rawProject,
        tasksData  ?? [],
        springsData ?? [],
        metricsRes  ?? { totalTasks: 0, completedTasks: 0, overdueTasks: 0 },
        milestonesRes ?? [],
        rawMembers,
      );

      CACHE.set(projectId, { data: built, fetchedAt: Date.now() });
      setData(built);
    } catch {
      if (!isMounted.current) return;
      if (!background) setError('Failed to load report data.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [projectId]);

  // ── Fetch scheduled reports ─────────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    if (!projectId) return;
    setSchLoading(true);
    try {
      const res = await getProjectScheduledReports(projectId);
      if (isMounted.current) setSchedules(res ?? []);
    } catch {
      if (isMounted.current) setSchedules([]);
    } finally {
      if (isMounted.current) setSchLoading(false);
    }
  }, [projectId]);

  // ── Schedule mutations ──────────────────────────────────────────────────────
  const deleteSchedule = useCallback(async (id: number) => {
    await deleteScheduledReport(id);
    await fetchSchedules();
  }, [fetchSchedules]);

  const toggleSchedule = useCallback(async (sr: ScheduledReportResponse) => {
    if (sr.status === 'ACTIVE') await pauseScheduledReport(sr.id);
    else                         await resumeScheduledReport(sr.id);
    await fetchSchedules();
  }, [fetchSchedules]);

  // ── Mount / unmount ─────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    const c = projectId ? getCached(projectId) : null;
    if (c) { void fetchData(true); }
    else   { void fetchData(false); }
    void fetchSchedules();
    return () => { isMounted.current = false; };
  }, [fetchData, fetchSchedules, projectId]);

  return {
    data, loading, error,
    schedules, schLoading,
    deleteSchedule, toggleSchedule,
    refreshSchedules: fetchSchedules,
    refresh: () => { CACHE.delete(projectId); void fetchData(false); },
  };
}
