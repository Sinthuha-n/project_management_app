'use client';

import useSWR from 'swr';
import { sprintsApi } from '@/services/api-contract';
import type { SprintVelocityPoint } from '@/services/tasks-contract';

export type SprintVelocityStatus = 'idle' | 'loading' | 'success' | 'error';

export function useSprintVelocity(projectId: string | null, enabled: boolean) {
  const key = enabled && projectId ? ['sprint-velocity', projectId] as const : null;
  const { data, error, isLoading, mutate } = useSWR<SprintVelocityPoint[]>(
    key,
    () => sprintsApi.getVelocity(projectId!),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  let status: SprintVelocityStatus = 'idle';
  if (enabled && isLoading) status = 'loading';
  else if (enabled && data) status = 'success';
  else if (enabled && error) status = 'error';

  return {
    data: data ?? [],
    status,
    error: error instanceof Error ? error.message : null,
    retry: () => mutate(),
  };
}
