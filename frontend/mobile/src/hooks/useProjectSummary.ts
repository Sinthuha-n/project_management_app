import { useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { offlineSyncManager } from '../services/offlineSyncManager';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: number;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  updatedAt?: string;
  createdAt?: string;
  completedAt?: string;
  assigneeName?: string;
  assigneePhotoUrl?: string;
  projectId?: number;
  sprintId?: number;
  storyPoint?: number;
}

export interface Sprint {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  inProgressTasks?: number;
}

export interface MilestoneItem {
  id: number;
  name: string;
  status: string;
  dueDate?: string;
  taskCount?: number;
}

export interface SummaryData {
  tasks: Task[];
  sprints: Sprint[];
  metrics: ProjectMetrics;
  projectDetails: { name?: string; description?: string; type?: string } | null;
  isAgile: boolean;
}

// ─── useProjectSummary Hook ────────────────────────────────────────────────────

const AGILE_TYPES = ['AGILE', 'SCRUM'];

export function useProjectSummary(projectId: number) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(offlineSyncManager.getOnlineStatus());
  const [isStale, setIsStale] = useState(true);

  const isMounted = useRef(true);
  const CACHE_KEY = `project_summary_${projectId}`;

  // ── Load cache on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { cachedData, cachedMilestones } = JSON.parse(cached);
          if (cachedData) setData(cachedData);
          if (cachedMilestones) setMilestones(cachedMilestones);
          setIsStale(true);
        }
      } catch (e) {
        console.error('Failed to load project summary cache', e);
      }
    })();
  }, [projectId, CACHE_KEY]);

  const fetchAll = useCallback(async (background = false) => {
    if (!projectId) return;
    if (!background) setLoading(true);
    setError(null);
    try {
      const [summaryRes, milestonesRes] = await Promise.all([
        api.get(`/api/projects/${projectId}/dashboard-summary`, { timeout: 15000 }),
        api.get(`/api/projects/${projectId}/milestones`).catch(() => ({ data: [] })),
      ]);

      if (!isMounted.current) return;

      const raw = summaryRes.data;
      const isAgile = AGILE_TYPES.includes(raw.projectDetails?.type?.toUpperCase() || '');

      const newData: SummaryData = {
        tasks: raw.tasks || [],
        sprints: raw.sprints || [],
        metrics: raw.metrics || { totalTasks: 0, completedTasks: 0, overdueTasks: 0 },
        projectDetails: raw.projectDetails || null,
        isAgile,
      };

      const newMilestones: MilestoneItem[] = milestonesRes.data || [];

      setData(newData);
      setMilestones(newMilestones);
      setIsStale(false);

      // Save cache
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          cachedData: newData,
          cachedMilestones: newMilestones,
        })
      );
    } catch {
      if (!isMounted.current) return;
      if (!background) setError('Failed to load project summary. Pull down to retry.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [projectId, CACHE_KEY]);

  useEffect(() => {
    isMounted.current = true;
    void fetchAll(false);
    return () => { isMounted.current = false; };
  }, [fetchAll]);

  // ── Listen to Sync Manager connection & sync events ────────────────────────
  useEffect(() => {
    const removeListener = offlineSyncManager.addListener((event) => {
      if (event.type === 'CONNECTION_CHANGED') {
        setIsOnline(event.isOnline);
      } else if (event.type === 'SYNC_COMPLETED' || event.type === 'TASK_CREATED' || event.type === 'TASK_UPDATED') {
        void fetchAll(true);
      }
    });
    return removeListener;
  }, [fetchAll]);

  return {
    data,
    milestones,
    loading,
    error,
    refresh: () => fetchAll(false),
    isOnline,
    isStale,
  };
}
