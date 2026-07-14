'use client';

import { useEffect } from 'react';
import { applyTaskMutation, subscribeToTaskMutations } from '@/lib/task-cache';

export default function TaskCacheProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => subscribeToTaskMutations(applyTaskMutation), []);
  return children;
}

