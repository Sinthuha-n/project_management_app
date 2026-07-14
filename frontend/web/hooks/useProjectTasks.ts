'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import type { Task } from '@/types';
import { tasksApi } from '@/services/tasks-contract';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import { TASK_CACHE_RETENTION_MS, taskKeys } from '@/lib/task-cache';

export function useProjectTasks(projectId: string | number | null, archived = false) {
  const [loadedNetworkKey, setLoadedNetworkKey] = useState<string | null>(null);
  const numericProjectId = projectId == null ? null : Number(projectId);
  const cacheKey = useMemo(() => (
    numericProjectId != null && Number.isFinite(numericProjectId)
      ? buildSessionCacheKey('project-tasks-v1', [numericProjectId, archived ? 'archived' : 'active'])
      : null
  ), [archived, numericProjectId]);

  const cachedTasks = useMemo(() => {
    if (!cacheKey) return undefined;
    return getSessionCache<Task[]>(cacheKey, { allowStale: true }).data ?? undefined;
  }, [cacheKey]);

  const networkKey = numericProjectId == null ? null : `${numericProjectId}:${archived ? 'archived' : 'active'}`;

  const swr = useSWR<Task[]>(
    numericProjectId != null && Number.isFinite(numericProjectId) ? taskKeys.project(numericProjectId, archived) : null,
    () => tasksApi.listAllByProject(numericProjectId!, { archived }),
    {
      fallbackData: cachedTasks,
      revalidateOnMount: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      dedupingInterval: 10_000,
      keepPreviousData: false,
      onSuccess: (tasks) => {
        setLoadedNetworkKey(networkKey);
        if (cacheKey) setSessionCache(cacheKey, tasks, TASK_CACHE_RETENTION_MS);
      },
    },
  );

  return {
    tasks: swr.data ?? [],
    error: swr.error,
    loading: swr.isLoading && !cachedTasks,
    validating: swr.isValidating,
    hasData: swr.data !== undefined,
    authoritative: loadedNetworkKey === networkKey || cachedTasks !== undefined,
    revalidate: swr.mutate,
  };
}
