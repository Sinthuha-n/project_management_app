'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Client, IMessage } from '@stomp/stompjs';
import * as notificationsApi from '@/services/notifications-service';
import { Notification } from '@/services/notifications-service';
import { toast } from '@/components/ui/Toast';
import { AUTH_TOKEN_CHANGED_EVENT, getValidToken } from '@/lib/auth';
import { resolveWebSocketBaseUrlDetails } from '@/lib/realtime-url';
import { getApiBaseUrl } from '@/lib/api-base-url';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';

interface GlobalNotificationContextType {
  client: Client | null;
  notifications: Notification[];
  unreadCount: number;
  realtimeConnected: boolean;
  realtimeReconnecting: boolean;
  subscribeRealtime: (
    destination: string,
    callback: (message: IMessage) => void,
  ) => { unsubscribe: () => void } | null;
  sendRealtime: (
    destination: string,
    body: string,
    options?: {
      headers?: Record<string, string>;
      queueWhenDisconnected?: boolean;
    },
  ) => void;
  retryRealtimeConnection: () => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotificationById: (id: number) => Promise<void>;
  deleteAllNotifications: () => Promise<{ deleted: number; failed: number }>;
}

const GlobalNotificationContext = createContext<GlobalNotificationContextType | undefined>(undefined);

const CHAT_PATH_PATTERN = /^\/project\/\d+\/chat\/?$/i;
const NOTIFICATIONS_CACHE_TTL_MS = 45_000;

type NotificationsCachePayload = {
  notifications: Notification[];
  unreadCount: number;
};

type QueuedRealtimeMessage = {
  destination: string;
  body: string;
  headers?: Record<string, string>;
};

function normalizePath(path: string): string {
  if (!path) return '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.endsWith('/') && normalized !== '/' ? normalized.slice(0, -1) : normalized;
}

function isOnRelevantRoute(currentPath: string | null, currentQuery: string, targetLink: string): boolean {
  if (!currentPath || !targetLink) return false;

  let targetPath = '';
  let targetParams = new URLSearchParams();

  try {
    const parsed = new URL(targetLink, 'http://localhost');
    targetPath = normalizePath(parsed.pathname);
    targetParams = parsed.searchParams;
  } catch {
    return false;
  }

  const currentNormalized = normalizePath(currentPath);

  if (CHAT_PATH_PATTERN.test(targetPath)) {
    if (currentNormalized !== targetPath) return false;

    const currentParams = new URLSearchParams(currentQuery || '');
    const targetEntries = Array.from(targetParams.entries());

    if (targetEntries.length === 0) {
      // Generic /chat links are only "active" when user is on the base chat route.
      return currentParams.toString().length === 0;
    }

    return targetEntries.every(([key, value]) => currentParams.get(key) === value);
  }

  return currentNormalized.includes(targetPath);
}

export function GlobalNotificationProvider({ children }: { children: React.ReactNode }) {
  const [clientState, setClientState] = useState<Client | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [realtimeReconnecting, setRealtimeReconnecting] = useState(false);
  const pathname = usePathname();
  // We use refs to avoid re-triggering stomp effects on route path transitions
  const pathnameRef = useRef(pathname);
  const searchRef = useRef('');
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());
  const notificationsCacheKeyRef = useRef<string | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const intentionallyClosingClientRef = useRef<Client | null>(null);
  const activeTokenRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const queuedRealtimeMessagesRef = useRef<QueuedRealtimeMessage[]>([]);
  const reconnectAttemptHandlerRef = useRef<(token: string) => void>(() => {});
  const backendUrl = getApiBaseUrl();

  useEffect(() => {
    pathnameRef.current = pathname;
    if (typeof window !== 'undefined') {
      searchRef.current = window.location.search.replace(/^\?/, '');
    }
  }, [pathname]);

  const loadInitialData = useCallback(async () => {
    try {
      const feed = await notificationsApi.fetchNotifications();
      setNotifications(feed.notifications);
      setUnreadCount(feed.unreadCount);
      seenNotificationIdsRef.current = new Set(feed.notifications.map((notif) => notif.id));
      const cacheKey = notificationsCacheKeyRef.current;
      if (cacheKey) {
        setSessionCache<NotificationsCachePayload>(
          cacheKey,
          {
            notifications: feed.notifications,
            unreadCount: feed.unreadCount,
          },
          NOTIFICATIONS_CACHE_TTL_MS,
        );
      }
    } catch (e) {
      console.warn('Failed to load initial notifications:', e instanceof Error ? e.message : 'Network error');
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const flushQueuedRealtimeMessages = useCallback((client: Client) => {
    if (queuedRealtimeMessagesRef.current.length === 0) {
      return;
    }

    const queuedMessages = queuedRealtimeMessagesRef.current;
    queuedRealtimeMessagesRef.current = [];
    queuedMessages.forEach((message) => {
      client.publish({
        destination: message.destination,
        body: message.body,
        headers: message.headers,
      });
    });
  }, []);

  const disconnectClient = useCallback(() => {
    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    queuedRealtimeMessagesRef.current = [];
    isConnectingRef.current = false;
    setRealtimeConnected(false);
    setRealtimeReconnecting(false);

    const client = stompClientRef.current;
    if (client) {
      intentionallyClosingClientRef.current = client;
      client.deactivate();
      stompClientRef.current = null;
    }

    setClientState(null);
  }, [clearReconnectTimer]);

  const handleConnectionLost = useCallback((client: Client, token: string) => {
    if (stompClientRef.current !== client || activeTokenRef.current !== token) {
      return;
    }

    stompClientRef.current = null;
    setClientState(null);
    isConnectingRef.current = false;
    setRealtimeConnected(false);
    setRealtimeReconnecting(true);
    reconnectAttemptHandlerRef.current(token);
  }, []);

  const connectRealtime = useCallback((token: string) => {
    clearReconnectTimer();
    isConnectingRef.current = true;
    activeTokenRef.current = token;
    intentionallyClosingClientRef.current = null;

    let wsUrl: string;
    try {
      const resolution = resolveWebSocketBaseUrlDetails(backendUrl);
      wsUrl = resolution.url;
      console.info(`[realtime-ws] Connecting to ${wsUrl}/ws-native via ${resolution.source}.`);
    } catch (error) {
      isConnectingRef.current = false;
      setRealtimeConnected(false);
      setRealtimeReconnecting(false);
      console.error('[realtime-ws] Cannot resolve WebSocket URL:', error instanceof Error ? error.message : error);
      return;
    }

    const client = new Client({
      brokerURL: `${wsUrl}/ws-native`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: () => {},
      reconnectDelay: 0,
      onConnect: () => {
        if (stompClientRef.current !== client) {
          return;
        }

        isConnectingRef.current = false;
        reconnectAttemptRef.current = 0;
        setRealtimeReconnecting(false);
        setRealtimeConnected(true);

        flushQueuedRealtimeMessages(client);

        client.subscribe('/user/queue/notifications', (payload) => {
          const newNotif: Notification = JSON.parse(payload.body);
          if (seenNotificationIdsRef.current.has(newNotif.id)) {
            return;
          }

          seenNotificationIdsRef.current.add(newNotif.id);

          // Add to state
          setNotifications((prev) => {
            return [newNotif, ...prev];
          });

          // Keep chat inbox badges synchronized with realtime notifications.
          window.dispatchEvent(new CustomEvent('planora:chat-inbox-updated'));

          // Current navigation path check
          const currentPath = pathnameRef.current;
          const currentQuery = searchRef.current;
          const targetPath = (newNotif.link as string) || '';

          const isOnRelevantPage = isOnRelevantRoute(currentPath, currentQuery, targetPath);

          if (!isOnRelevantPage) {
            toast(newNotif.message, 'info', 5000);
          } else {
            // If we're on the relevant page, we can instantly mark it as read behind the scenes
            notificationsApi.markNotificationRead(newNotif.id).catch(() => {});
            setNotifications((prev) =>
              prev.map((n) => (n.id === newNotif.id ? { ...n, read: true } : n))
            );
          }
        });

        client.subscribe('/user/queue/notifications-badge', (payload) => {
          const newCount = Number(payload.body);
          if (!isNaN(newCount)) {
            setUnreadCount(newCount);
          }
        });
      },
      onStompError: (frame) => {
        console.warn('[realtime-ws] STOMP error:', frame.headers?.message || frame.body || 'Unknown STOMP error');
        handleConnectionLost(client, token);
      },
      onWebSocketClose: (event) => {
        if (intentionallyClosingClientRef.current === client) {
          intentionallyClosingClientRef.current = null;
          return;
        }

        console.warn('[realtime-ws] WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        handleConnectionLost(client, token);
      },
    });

    stompClientRef.current = client;
    setClientState(client);
    client.activate();
  }, [backendUrl, clearReconnectTimer, flushQueuedRealtimeMessages, handleConnectionLost]);

  const scheduleReconnect = useCallback((token: string) => {
    if (!token || reconnectTimerRef.current !== null) {
      return;
    }

    const delay = Math.min(1000 * (2 ** reconnectAttemptRef.current), 30_000);
    reconnectAttemptRef.current += 1;
    setRealtimeConnected(false);
    setRealtimeReconnecting(true);

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRealtime(token);
    }, delay);
  }, [connectRealtime]);

  useEffect(() => {
    reconnectAttemptHandlerRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  const retryRealtimeConnection = useCallback(() => {
    const token = activeTokenRef.current || getValidToken();
    if (!token) {
      return;
    }

    clearReconnectTimer();
    reconnectAttemptRef.current = 0;
    setRealtimeReconnecting(true);
    connectRealtime(token);
  }, [clearReconnectTimer, connectRealtime]);

  const syncAuthAndConnection = useCallback(() => {
    const token = getValidToken();

    if (!token) {
      activeTokenRef.current = null;
      notificationsCacheKeyRef.current = null;
      disconnectClient();
      setNotifications([]);
      setUnreadCount(0);
      seenNotificationIdsRef.current.clear();
      return;
    }

    const nextCacheKey = buildSessionCacheKey('notifications', ['global'], token);
    notificationsCacheKeyRef.current = nextCacheKey;

    const tokenChanged = activeTokenRef.current !== token;

    if (tokenChanged) {
      setNotifications([]);
      setUnreadCount(0);
      seenNotificationIdsRef.current.clear();
    }

    let shouldLoadInitialData = tokenChanged;
    if (nextCacheKey) {
      const cached = getSessionCache<NotificationsCachePayload>(nextCacheKey, { allowStale: true });
      if (cached.data) {
        setNotifications(cached.data.notifications || []);
        setUnreadCount(Number(cached.data.unreadCount) || 0);
        seenNotificationIdsRef.current = new Set((cached.data.notifications || []).map((notif) => notif.id));
        if (!cached.isStale) {
          shouldLoadInitialData = false;
        }
      }
    }

    if (shouldLoadInitialData) {
      void loadInitialData();
    }

    if (tokenChanged || (!stompClientRef.current?.connected && !isConnectingRef.current && reconnectTimerRef.current === null)) {
      connectRealtime(token);
    }
  }, [connectRealtime, disconnectClient, loadInitialData]);

  useEffect(() => {
    const cacheKey = notificationsCacheKeyRef.current;
    if (!cacheKey) return;

    setSessionCache<NotificationsCachePayload>(
      cacheKey,
      {
        notifications,
        unreadCount,
      },
      NOTIFICATIONS_CACHE_TTL_MS,
    );
  }, [notifications, unreadCount]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token' || event.key === null) {
        syncAuthAndConnection();
      }
    };

    const handleAuthTokenChanged = () => {
      syncAuthAndConnection();
    };

    const handleFocus = () => {
      syncAuthAndConnection();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        syncAuthAndConnection();
      }
    };

    const initialSyncTimer = window.setTimeout(() => {
      syncAuthAndConnection();
    }, 0);

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(initialSyncTimer);

      activeTokenRef.current = null;
      disconnectClient();
    };
  }, [syncAuthAndConnection, disconnectClient]);

  const subscribeRealtime = useCallback(
    (
      destination: string,
      callback: (message: IMessage) => void,
    ): { unsubscribe: () => void } | null => {
      const client = stompClientRef.current;
      if (!client?.connected) return null;
      return client.subscribe(destination, callback);
    },
    [],
  );

  const sendRealtime = useCallback(
    (
      destination: string,
      body: string,
      options?: {
        headers?: Record<string, string>;
        queueWhenDisconnected?: boolean;
      },
    ) => {
      const client = stompClientRef.current;
      if (!client?.connected) {
        if (options?.queueWhenDisconnected) {
          queuedRealtimeMessagesRef.current.push({
            destination,
            body,
            headers: options.headers,
          });
        }
        return;
      }

      client.publish({ destination, body, headers: options?.headers });
    },
    [],
  );

  const markAsRead = async (id: number) => {
    try {
      await notificationsApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.warn('Failed to mark read:', e instanceof Error ? e.message : 'Network error');
      throw e;
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('Failed to mark all read:', e instanceof Error ? e.message : 'Network error');
      throw e;
    }
  };

  const deleteNotificationById = async (id: number) => {
    await notificationsApi.deleteNotification(id);
    setNotifications((prev) => {
      const next = prev.filter((notif) => notif.id !== id);
      setUnreadCount(next.filter((notif) => !notif.read).length);
      return next;
    });
  };

  const deleteAllNotifications = async (): Promise<{ deleted: number; failed: number }> => {
    const ids = notifications.map((notification) => notification.id);
    if (ids.length === 0) {
      return { deleted: 0, failed: 0 };
    }

    const results = await notificationsApi.deleteAllNotifications(ids);
    const successfulIds = new Set<number>();

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulIds.add(ids[index]);
      }
    });

    setNotifications((prev) => {
      const next = prev.filter((notif) => !successfulIds.has(notif.id));
      setUnreadCount(next.filter((notif) => !notif.read).length);
      return next;
    });

    return {
      deleted: successfulIds.size,
      failed: ids.length - successfulIds.size,
    };
  };

  return (
    <GlobalNotificationContext.Provider
      value={{
        client: clientState,
        notifications,
        unreadCount,
        realtimeConnected,
        realtimeReconnecting,
        subscribeRealtime,
        sendRealtime,
        retryRealtimeConnection,
        markAsRead,
        markAllAsRead,
        deleteNotificationById,
        deleteAllNotifications,
      }}
    >
      {children}
    </GlobalNotificationContext.Provider>
  );
}

export function useGlobalNotifications() {
  const context = useContext(GlobalNotificationContext);
  if (context === undefined) {
    throw new Error('useGlobalNotifications must be used within a GlobalNotificationProvider');
  }
  return context;
}
