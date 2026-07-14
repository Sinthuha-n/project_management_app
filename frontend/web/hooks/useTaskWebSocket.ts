'use client';

import { useEffect, useRef, useState } from 'react';
import { CompatClient, Stomp } from '@stomp/stompjs';
import { AUTH_TOKEN_CHANGED_EVENT, ensureValidToken } from '@/lib/auth';
import { resolveWebSocketBaseUrl } from '@/lib/realtime-url';
import { getApiBaseUrl } from '@/lib/api-base-url';
import { applyTaskMutation, createMutationId, type TaskMutationOperation } from '@/lib/task-cache';
import type { Task } from '@/types';

interface TaskEvent {
  type: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_STATUS_CHANGED';
  task?: {
    id: number;
    projectTaskNumber?: number;
    title: string;
    storyPoint: number;
    status: string;
    priority: string;
    projectId?: number | null;
    sprintId: number | null;
    milestoneId?: number | null;
    milestoneName?: string | null;
    assigneeName: string | null;
    assigneePhotoUrl: string | null;
    assignees?: Array<{ id?: number; userId?: number; name?: string; username?: string; photoUrl?: string | null; avatar?: string | null }>;
    startDate: string | null;
    dueDate: string | null;
    archived?: boolean;
    archivedAt?: string | null;
  };
  taskId?: number;
  status?: string;
  projectId?: number;
}

export function useTaskWebSocket(
  projectId: string | null,
  onEvent: (event: TaskEvent) => void
) {
  const clientRef = useRef<CompatClient | null>(null);
  const onEventRef = useRef(onEvent);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectingRef = useRef(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!projectId) return;

    let disposed = false;

    const backendUrl = getApiBaseUrl();
    const wsUrl = resolveWebSocketBaseUrl(backendUrl);

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const isAuthError = (error: unknown): boolean => {
      const headers = (error as { headers?: Record<string, string> })?.headers;
      const errorCode = headers?.['x-error-code'];
      if (errorCode === 'AUTH_EXPIRED' || errorCode === 'AUTH_INVALID') {
        return true;
      }
      const message = typeof error === 'string'
        ? error
        : (headers?.message || '');
      const normalized = message.toLowerCase();
      return normalized.includes('auth')
        || normalized.includes('jwt')
        || normalized.includes('token')
        || normalized.includes('expired')
        || normalized.includes('invalid');
    };

    const scheduleReconnect = (delayOverride?: number) => {
      if (disposed) return;
      clearReconnectTimer();
      const baseDelay = Math.min(30000, Math.pow(2, reconnectAttemptRef.current) * 1000);
      const delay = delayOverride ?? baseDelay;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connectClient();
      }, delay);
    };

    const connectClient = async () => {
      if (disposed || connectingRef.current) return;
      connectingRef.current = true;

      try {
        const token = await ensureValidToken();
        if (!token) {
          connectingRef.current = false;
          clientRef.current = null;
          return;
        }

        const stompClient = Stomp.client(`${wsUrl}/ws-native`);
        stompClient.debug = () => {};
        stompClient.reconnect_delay = 0;

        stompClient.connect(
          { Authorization: `Bearer ${token}` },
          () => {
            if (disposed) {
              try {
                stompClient.disconnect();
              } catch {
                // ignore disconnect races
              }
              return;
            }
            reconnectAttemptRef.current = 0;
            connectingRef.current = false;
            clientRef.current = stompClient;
            setReconnectCount((prev) => prev + 1);
          },
          async (error: unknown) => {
            connectingRef.current = false;
            clientRef.current = null;

            if (isAuthError(error)) {
              const refreshedToken = await ensureValidToken();
              if (refreshedToken) {
                reconnectAttemptRef.current = 0;
                scheduleReconnect(500);
              }
              return;
            }

            reconnectAttemptRef.current += 1;
            scheduleReconnect();
          }
        );
      } catch {
        connectingRef.current = false;
        reconnectAttemptRef.current += 1;
        scheduleReconnect();
      }
    };

    const reconnectOnTokenChange = () => {
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();
      const existing = clientRef.current;
      clientRef.current = null;
      if (existing?.connected) {
        existing.disconnect(() => {
          connectClient();
        });
        return;
      }
      connectClient();
    };

    connectClient();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, reconnectOnTokenChange);

    return () => {
      disposed = true;
      connectingRef.current = false;
      clearReconnectTimer();
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, reconnectOnTokenChange);
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      const existing = clientRef.current;
      if (existing?.connected) {
        existing.disconnect();
      }
      clientRef.current = null;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !clientRef.current?.connected) return;

    const subscription = clientRef.current.subscribe(
      `/topic/project/${projectId}/tasks`,
      (message) => {
        try {
          const event = JSON.parse(message.body) as TaskEvent;
          const taskId = event.task?.id ?? event.taskId;
          if (taskId != null) {
            const operation: TaskMutationOperation = event.type === 'TASK_CREATED'
              ? 'created'
              : event.type === 'TASK_DELETED'
                ? 'deleted'
                : 'updated';
            applyTaskMutation({
              operation,
              projectId: Number(event.task?.projectId ?? event.projectId ?? projectId),
              taskId,
              mutationId: createMutationId(),
              source: 'websocket',
              task: event.task ? event.task as unknown as Task : undefined,
              patch: event.status ? { status: event.status } : undefined,
              occurredAt: new Date().toISOString(),
            });
          }
          onEventRef.current(event);
        } catch {
          // ignore parse errors
        }
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      subscriptionRef.current?.unsubscribe();
      if (subscriptionRef.current === subscription) {
        subscriptionRef.current = null;
      }
    };
  }, [projectId, reconnectCount]);
}
