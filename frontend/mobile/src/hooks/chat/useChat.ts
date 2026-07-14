import { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import * as chatService from '../../services/chatService';
import { API_BASE_URL } from '../../api/axios';
import { ChatMessage, ChatFeatureFlags } from '../../types/chat';
import { useChatRooms } from './useChatRooms';
import { useChatMessages } from './useChatMessages';
import { useChatPresence } from './useChatPresence';
import { useChatReactions } from './useChatReactions';
import { useChatSearch } from './useChatSearch';
import { useChatThreads } from './useChatThreads';
import { useChatUnread } from './useChatUnread';
import { ensureValidToken, refreshAccessToken } from '@/src/auth/storage';
import { AUTH_TOKEN_CHANGED_EVENT, type AuthTokenChangedPayload, decodeJwtPayload } from '@/src/lib/auth';
import { offlineSyncManager } from '../../services/offlineSyncManager';
import {
  addChatOfflineListener,
  cacheChatSnapshot,
  enqueueChatMessage,
  loadCachedChat,
  syncQueuedChatMessages,
  type QueuedChatMessage,
} from '../../services/chatOfflineService';
import {
  buildStompConnect as buildConnect,
  buildStompSend as buildSend,
  buildStompSubscribe as buildSubscribe,
  parseStompFrame as parseFrame,
  sendStompFrame,
} from '../../realtime/stompFrames';

// ── Minimal inline STOMP builder/parser ──────────────────────────────────────

function dmKey(username: string): string {
  return username.trim().toLowerCase();
}

function addUniqueUserByKey(prev: string[], username: string) {
  const key = dmKey(username);
  if (!key || prev.some(u => dmKey(u) === key)) return prev;
  return [...prev, username];
}

function uniqueUsersByKey(usernames: string[]) {
  return usernames.reduce<string[]>((acc, username) => addUniqueUserByKey(acc, username), []);
}

const TOKEN_REFRESH_SKEW_MS = 60_000;
const MIN_TOKEN_REFRESH_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

function isUsablePlanoraAccessToken(token: string | null): token is string {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return false;
  if (payload.tokenType && String(payload.tokenType).toUpperCase() !== 'ACCESS') return false;
  if (payload.exp && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useChat(projectId: string) {
  const [currentUser, setCurrentUser] = useState('');
  const [currentUserAliases, setCurrentUserAliases] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [userProfilePics, setUserProfilePics] = useState<Record<string, string>>({});
  const [featureFlags, setFeatureFlags] = useState<ChatFeatureFlags>({
    phaseDEnabled: false, phaseEEnabled: false,
    webhooksEnabled: false, telemetryEnabled: false,
  });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [error, setError] = useState('');
  const [isNetworkOnline, setIsNetworkOnline] = useState(offlineSyncManager.getOnlineStatus());
  const [queuedChatCount, setQueuedChatCount] = useState(0);
  const [failedChatCount, setFailedChatCount] = useState(0);
  const [serverChangedWhileOffline, setServerChangedWhileOffline] = useState(false);

  // Refs so socket handlers always read fresh values without stale closures
  const currentUserRef = useRef('');
  const selectedUserRef = useRef<string | null>(null);
  const usersRef = useRef<string[]>([]);
  const selectedRoomIdRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isConnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const stompConnectedRef = useRef(false);
  const authenticatedProjectRef = useRef(false);
  // Track which rooms we've subscribed to already
  const subscribedRoomsRef = useRef<Set<number>>(new Set());

  const roomsHook     = useChatRooms(projectId);
  const messagesHook  = useChatMessages(projectId);
  const presenceHook  = useChatPresence(projectId);
  const reactionsHook = useChatReactions(projectId);
  const searchHook    = useChatSearch(projectId);
  const threadsHook   = useChatThreads(projectId);
  const unreadHook    = useChatUnread(projectId);

  const { selectedRoomId, selectRoom, rooms } = roomsHook;

  // Keep refs in sync
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);

  const getActiveLastMessageId = useCallback((roomId?: number, recipient?: string | null) => {
    const source = roomId != null
      ? (messagesHook.roomMessages[roomId] || [])
      : recipient
        ? (messagesHook.privateMessages[dmKey(recipient)] || [])
        : messagesHook.messages;
    return source.find(message => !!message.id)?.id ?? null;
  }, [messagesHook.messages, messagesHook.privateMessages, messagesHook.roomMessages]);

  const loadLatestForQueuedMessage = useCallback((item: QueuedChatMessage) => {
    if (item.scope.type === 'ROOM') {
      return chatService.fetchRoomHistory(projectId, item.scope.roomId);
    }
    if (item.scope.type === 'PRIVATE') {
      return chatService.fetchPrivateHistory(projectId, item.scope.recipient);
    }
    return chatService.fetchTeamMessages(projectId);
  }, [projectId]);

  useEffect(() => {
    const unsubscribeNetwork = offlineSyncManager.addListener((event) => {
      if (event.type === 'CONNECTION_CHANGED') {
        setIsNetworkOnline(event.isOnline);
        if (event.isOnline) {
          void syncQueuedChatMessages(projectId, loadLatestForQueuedMessage);
        }
      }
    });

    const unsubscribeChat = addChatOfflineListener((event) => {
      if (event.projectId !== projectId) return;
      if (event.type === 'QUEUE_CHANGED') {
        setQueuedChatCount(event.queue.filter(item => item.status === 'pending' || item.status === 'syncing').length);
        setFailedChatCount(event.queue.filter(item => item.status === 'failed').length);
        return;
      }
      if (event.type === 'MESSAGE_SYNCED') {
        setServerChangedWhileOffline(prev => prev || event.serverChangedWhileOffline);
        if (event.serverChangedWhileOffline) {
          const scope = event.queueItem.scope;
          if (scope.type === 'ROOM') {
            event.latestMessages.forEach(message => messagesHook.addRoomMessage(scope.roomId, message));
          } else if (scope.type === 'PRIVATE') {
            event.latestMessages.forEach(message => messagesHook.addPrivateMessage(scope.recipient, message));
          } else {
            event.latestMessages.forEach(message => messagesHook.addTeamMessage(message));
          }
        }
        messagesHook.setMessages(prev => prev.map(message =>
          message.localId === event.localId ? { ...message, ...event.message } : message
        ));
        messagesHook.setRoomMessages(prev => {
          const next = { ...prev };
          Object.keys(next).forEach((roomId) => {
            next[+roomId] = next[+roomId].map(message =>
              message.localId === event.localId ? { ...message, ...event.message } : message
            );
          });
          return next;
        });
        messagesHook.setPrivateMessages(prev => {
          const next = { ...prev };
          Object.keys(next).forEach((partner) => {
            next[partner] = next[partner].map(message =>
              message.localId === event.localId ? { ...message, ...event.message } : message
            );
          });
          return next;
        });
        return;
      }
      if (event.type === 'MESSAGE_FAILED') {
        const markFailed = (message: ChatMessage) => (
          message.localId === event.localId
            ? { ...message, syncStatus: 'failed' as const, failureReason: event.error }
            : message
        );
        messagesHook.setMessages(prev => prev.map(markFailed));
        messagesHook.setRoomMessages(prev => {
          const next = { ...prev };
          Object.keys(next).forEach((roomId) => { next[+roomId] = next[+roomId].map(markFailed); });
          return next;
        });
        messagesHook.setPrivateMessages(prev => {
          const next = { ...prev };
          Object.keys(next).forEach((partner) => { next[partner] = next[partner].map(markFailed); });
          return next;
        });
      }
    });

    void syncQueuedChatMessages(projectId, loadLatestForQueuedMessage);

    return () => {
      unsubscribeNetwork();
      unsubscribeChat();
    };
  // Listener callbacks only use React state setters from messagesHook, which are stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLatestForQueuedMessage, projectId]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const clearTokenRefreshTimer = useCallback(() => {
    if (tokenRefreshRef.current) {
      clearTimeout(tokenRefreshRef.current);
      tokenRefreshRef.current = null;
    }
  }, []);

  const clearSubscribedRooms = useCallback(() => {
    subscribedRoomsRef.current.clear();
  }, []);

  const closeSocketForReconnect = useCallback((reason = 'credential-rotated') => {
    const ws = socketRef.current;
    stompConnectedRef.current = false;
    setIsSocketConnected(false);
    clearSubscribedRooms();
    if (!ws) return;
    try {
      ws.close(4001, reason);
    } catch {
      socketRef.current = null;
      isConnectingRef.current = false;
    }
  }, [clearSubscribedRooms]);

  const scheduleTokenRefreshReconnect = useCallback((token: string) => {
    clearTokenRefreshTimer();
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return;

    const refreshIn = Math.max(
      MIN_TOKEN_REFRESH_DELAY_MS,
      payload.exp * 1000 - Date.now() - TOKEN_REFRESH_SKEW_MS,
    );

    tokenRefreshRef.current = setTimeout(() => {
      tokenRefreshRef.current = null;
      refreshAccessToken()
        .then(() => {
          reconnectAttemptRef.current = 0;
          closeSocketForReconnect('credential-refresh');
        })
        .catch(() => {
          setError('Your session expired. Please sign in again.');
          shouldReconnectRef.current = false;
          closeSocketForReconnect('jwt-expired');
        });
    }, refreshIn);
  }, [clearTokenRefreshTimer, closeSocketForReconnect]);

  // ── Subscribe to a single room's message + typing channels ──────────────────
  const subscribeRoom = useCallback((ws: WebSocket, roomId: number) => {
    const visibleRoom = roomsHook.rooms.some(room =>
      room.id === roomId && (room.projectId == null || String(room.projectId) === String(projectId))
    );
    if (!visibleRoom) {
      console.warn(`[Chat] Refusing to subscribe to room ${roomId}; not visible for project ${projectId}`);
      return;
    }
    if (subscribedRoomsRef.current.has(roomId)) return;
    subscribedRoomsRef.current.add(roomId);
    sendStompFrame(ws, buildSubscribe(`sub-room-${roomId}`, `/topic/project/${projectId}/room/${roomId}`));
    sendStompFrame(ws, buildSubscribe(`sub-room-typing-${roomId}`, `/topic/project/${projectId}/typing/room/${roomId}`));
  }, [projectId, roomsHook.rooms]);

  // ── Handle incoming STOMP MESSAGE frames ─────────────────────────────────────
  const handleMessage = useCallback((frame: ReturnType<typeof parseFrame>) => {
    if (!frame.body) return;
    let body: any;
    try { body = JSON.parse(frame.body); } catch { return; }
    const dest = frame.headers.destination || '';
    const me = currentUserRef.current.toLowerCase();

    // ── Team / public channel ─────────────────────────────────────────────────
    if (dest === `/topic/project/${projectId}/public`) {
      if (body.type === 'JOIN') {
        if (body.sender !== me) {
          setUsers(prev => addUniqueUserByKey(prev, body.sender));
        }
        return;
      }
      if (!body.roomId && !body.recipient && !body.parentMessageId) {
        messagesHook.addTeamMessage(body);
        unreadHook.setTeamLastMessage(body);
        if (body.sender?.toLowerCase() !== me && (selectedRoomIdRef.current !== null || selectedUserRef.current !== null)) {
          unreadHook.setTeamUnseenCount(prev => prev + 1);
        }
      }
      return;
    }

    // ── Private / DM channel ─────────────────────────────────────────────────
    if (dest === `/user/queue/project/${projectId}/messages`) {
      const sender = (body.sender || '').toLowerCase();
      const recipient = (body.recipient || '').toLowerCase();
      const isFromMe = sender === me;
      const partner = isFromMe ? recipient : sender;
      const partnerDisplay = isFromMe ? body.recipient : body.sender;
      if (!partner || body.parentMessageId) return;
      messagesHook.addPrivateMessage(partner, body);
      unreadHook.setPrivateLastMessages(prev => ({ ...prev, [partner]: body }));
      if (!isFromMe && selectedUserRef.current?.toLowerCase() !== partner) {
        unreadHook.setPrivateUnseenCounts(prev => ({ ...prev, [partner]: (prev[partner] || 0) + 1 }));
      }
      setUsers(prev => addUniqueUserByKey(prev, partnerDisplay || partner));
      return;
    }

    // ── Room message ──────────────────────────────────────────────────────────
    const roomMsgMatch = dest.match(new RegExp(`/topic/project/${projectId}/room/(\\d+)$`));
    if (roomMsgMatch) {
      const roomId = Number(roomMsgMatch[1]);
      if (!body.parentMessageId) {
        messagesHook.addRoomMessage(roomId, body);
        unreadHook.setRoomLastMessages(prev => ({ ...prev, [roomId]: body }));
        if (body.sender?.toLowerCase() !== me && selectedRoomIdRef.current !== roomId) {
          unreadHook.setRoomUnseenCounts(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
        }
      }
      return;
    }

    // ── Team typing ───────────────────────────────────────────────────────────
    if (dest === `/topic/project/${projectId}/typing/team`) {
      presenceHook.handleTypingEvent({ username: body.sender, isTyping: body.isTyping ?? body.typing });
      return;
    }

    // ── Private typing ────────────────────────────────────────────────────────
    if (dest === `/user/queue/project/${projectId}/typing/private`) {
      presenceHook.handleTypingEvent({ username: body.sender, isTyping: body.isTyping ?? body.typing, isPrivate: true });
      return;
    }

    // ── Room typing ───────────────────────────────────────────────────────────
    const roomTypingMatch = dest.match(new RegExp(`/topic/project/${projectId}/typing/room/(\\d+)$`));
    if (roomTypingMatch) {
      const roomId = Number(roomTypingMatch[1]);
      presenceHook.handleTypingEvent({ username: body.sender, roomId, isTyping: body.isTyping ?? body.typing });
      return;
    }

    // ── Unread badge update ───────────────────────────────────────────────────
    if (dest === `/user/queue/project/${projectId}/unread-badge`) {
      unreadHook.loadSummaries();
      return;
    }

    // ── Thread reply ──────────────────────────────────────────────────────────
    const threadMatch = dest.match(new RegExp(`/topic/project/${projectId}/thread/(\\d+)$`));
    if (threadMatch) {
      threadsHook.setThreadMessages(prev => [...prev, body]);
      return;
    }

    // ── Reaction update ───────────────────────────────────────────────────────
    const reactionMatch = dest.match(new RegExp(`/topic/project/${projectId}/messages/(\\d+)/reactions$`));
    if (reactionMatch) {
      const msgId = Number(reactionMatch[1]);
      reactionsHook.setMessageReactions(prev => ({ ...prev, [msgId]: body }));
      return;
    }

    // ── Presence ──────────────────────────────────────────────────────────────
    if (dest === `/topic/project/${projectId}/presence`) {
      presenceHook.handlePresenceEvent(body);
      return;
    }
  }, [projectId, messagesHook, presenceHook, reactionsHook, threadsHook, unreadHook]);

  // ── Connect WebSocket ─────────────────────────────────────────────────────
  const connectWebSocket = useCallback(async () => {
    shouldReconnectRef.current = true;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    if (isConnectingRef.current) return;
    if (!authenticatedProjectRef.current) {
      setError('Chat is not available for this project.');
      return;
    }
    isConnectingRef.current = true;

    const scheduleReconnect = (delayOverride?: number) => {
      if (!shouldReconnectRef.current || !authenticatedProjectRef.current) return;
      if (reconnectRef.current) return;
      const baseDelay = Math.min(MAX_RECONNECT_DELAY_MS, Math.pow(2, reconnectAttemptRef.current) * 1000);
      const jitter = delayOverride == null ? Math.floor(Math.random() * 250) : 0;
      const delay = (delayOverride ?? baseDelay) + jitter;
      reconnectAttemptRef.current += 1;
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        connectWebSocket();
      }, delay);
    };

    try {
      const token = await ensureValidToken();
      if (!isUsablePlanoraAccessToken(token)) {
        setError('Not authenticated');
        isConnectingRef.current = false;
        scheduleReconnect();
        return;
      }

      const base = API_BASE_URL.replace(/\/api$/, '');
      const wsUrl = base.replace(/^https?/, 'ws') + '/ws-native';

      console.info('[Chat] Connecting:', wsUrl);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (socketRef.current !== ws) { ws.close(); return; }
        isConnectingRef.current = false;
        console.info('[Chat] WS open — sending STOMP CONNECT');
        sendStompFrame(ws, buildConnect(token));
      };

      ws.onmessage = async (e) => {
        if (socketRef.current !== ws) return;
        try {
          let raw = e.data;
          if (typeof raw !== 'string') {
            raw = await new Promise<string>(res => {
              const fr = new FileReader();
              fr.onload = () => res(fr.result as string);
              fr.readAsText(raw);
            });
          }
          const frame = parseFrame(raw);
          if (frame.command === 'CONNECTED') {
            console.info('[Chat] STOMP CONNECTED');
            reconnectAttemptRef.current = 0;
            stompConnectedRef.current = true;
            setIsSocketConnected(true);
            setIsNetworkOnline(true);
            setError('');
            clearSubscribedRooms();
            scheduleTokenRefreshReconnect(token);
            void syncQueuedChatMessages(projectId, loadLatestForQueuedMessage);

            // Core subscriptions
            sendStompFrame(ws, buildSubscribe('sub-public', `/topic/project/${projectId}/public`));
            sendStompFrame(ws, buildSubscribe('sub-private', `/user/queue/project/${projectId}/messages`));
            sendStompFrame(ws, buildSubscribe('sub-typing-team', `/topic/project/${projectId}/typing/team`));
            sendStompFrame(ws, buildSubscribe('sub-typing-private', `/user/queue/project/${projectId}/typing/private`));
            sendStompFrame(ws, buildSubscribe('sub-unread', `/user/queue/project/${projectId}/unread-badge`));
            sendStompFrame(ws, buildSubscribe('sub-presence', `/topic/project/${projectId}/presence`));
            sendStompFrame(ws, buildSubscribe('sub-rooms-events', `/topic/project/${projectId}/rooms`));
            sendStompFrame(ws, buildSubscribe('sub-message-reactions', `/topic/project/${projectId}/messages/*/reactions`));

            // Subscribe to all already-loaded rooms
            roomsHook.rooms.forEach(r => subscribeRoom(ws, r.id));

            // Send presence ping
            sendStompFrame(ws, buildSend(`/app/project/${projectId}/presence.ping`, '{}'));
          } else if (frame.command === 'MESSAGE') {
            handleMessage(frame);
          } else if (frame.command === 'ERROR') {
            console.error('[Chat] STOMP ERROR', frame.body);
            const errorCode = frame.headers?.['x-error-code'];
            let isAuthError = errorCode === 'AUTH_EXPIRED' || errorCode === 'AUTH_INVALID';
            if (!isAuthError) {
              const normalizedBody = (frame.body || '').toLowerCase();
              isAuthError = normalizedBody.includes('jwt')
                || normalizedBody.includes('auth')
                || normalizedBody.includes('token')
                || normalizedBody.includes('expired')
                || normalizedBody.includes('invalid');
            }

            if (isAuthError) {
              const refreshedToken = await refreshAccessToken().catch(() => null);
              if (!refreshedToken) {
                setError('Your session expired. Please sign in again.');
                shouldReconnectRef.current = false;
              } else {
                reconnectAttemptRef.current = 0;
              }
              try {
                ws.close(4001, refreshedToken ? 'credential-refresh' : 'jwt-expired');
              } catch {
                setIsSocketConnected(false);
                socketRef.current = null;
                isConnectingRef.current = false;
                scheduleReconnect(500);
              }
              return;
            }

            setError('Chat server error. Please reconnect.');
          }
        } catch (err) {
          console.error('[Chat] frame parse error', err);
        }
      };

      ws.onclose = (event) => {
        if (socketRef.current !== ws) return;
        console.warn(`[Chat] WS closed — code: ${event.code}, reason: "${event.reason || '(none)'}"`);
        setIsSocketConnected(false);
        stompConnectedRef.current = false;
        socketRef.current = null;
        isConnectingRef.current = false;
        clearTokenRefreshTimer();
        clearSubscribedRooms();

        const closeReason = `${event.reason || ''}`.toLowerCase();
        const isAuthClose = closeReason.includes('jwt')
          || closeReason.includes('auth')
          || closeReason.includes('token')
          || closeReason.includes('expired')
          || closeReason.includes('invalid');

        if (shouldReconnectRef.current && !reconnectRef.current) {
          if (isAuthClose) {
            refreshAccessToken()
              .then(() => {
                reconnectAttemptRef.current = 0;
                scheduleReconnect(500);
              })
              .catch(() => {
                setError('Your session expired. Please sign in again.');
                shouldReconnectRef.current = false;
              });
            return;
          }
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (socketRef.current !== ws) return;
        if (__DEV__) {
          console.info('[Chat] WS connection error; reconnect will be attempted');
        }
        setError('Connection error. Retrying...');
        stompConnectedRef.current = false;
        isConnectingRef.current = false;
        try {
          ws.close();
        } catch {
          socketRef.current = null;
        }
      };
    } catch (err) {
      console.error('[Chat] connect failed', err);
      setError('Failed to connect to chat server');
      isConnectingRef.current = false;
      scheduleReconnect();
    }
  }, [projectId, handleMessage, subscribeRoom, roomsHook.rooms, clearTokenRefreshTimer, scheduleTokenRefreshReconnect, clearSubscribedRooms, loadLatestForQueuedMessage]);

  // ── Subscribe to new rooms when they are loaded/created ───────────────────
  useEffect(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    rooms.forEach(r => subscribeRoom(ws, r.id));
  }, [rooms, subscribeRoom]);

  useEffect(() => {
    const handleTokenChanged = (payload: AuthTokenChangedPayload) => {
      if (payload.reason === 'clear' || !isUsablePlanoraAccessToken(payload.token)) {
        shouldReconnectRef.current = false;
        clearReconnectTimer();
        clearTokenRefreshTimer();
        closeSocketForReconnect('signed-out');
        setError('Your session expired. Please sign in again.');
        return;
      }

      shouldReconnectRef.current = true;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();

      const ws = socketRef.current;
      if (stompConnectedRef.current || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        closeSocketForReconnect('credential-rotated');
        return;
      }

      if (authenticatedProjectRef.current) {
        connectWebSocket();
      }
    };

    if (Platform.OS === 'web') {
      const listener = (event: Event) => {
        handleTokenChanged((event as CustomEvent<AuthTokenChangedPayload>).detail);
      };
      globalThis.window?.addEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
      return () => globalThis.window?.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
    }

    const subscription = DeviceEventEmitter.addListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChanged);
    return () => subscription.remove();
  }, [clearReconnectTimer, clearTokenRefreshTimer, closeSocketForReconnect, connectWebSocket]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    authenticatedProjectRef.current = false;
    shouldReconnectRef.current = true;
    const init = async () => {
      setIsLoading(true);
      let initialized = false;
      const hadCachedMessages = await messagesHook.hydrateCachedMessages();
      try {
        const [user, members, roomsData, flags, profilePics] = await Promise.all([
          chatService.fetchCurrentUser(),
          chatService.fetchProjectUsers(projectId),
          chatService.fetchRooms(projectId),
          chatService.fetchFeatureFlags(projectId),
          chatService.fetchUserProfilePics(projectId).catch(() => ({})),
        ]);
        if (cancelled) return;

        currentUserRef.current = user.username.toLowerCase();
        setCurrentUser(user.username);
        setCurrentUserAliases(user.aliases || []);
        setUsers(uniqueUsersByKey(members));
        setFeatureFlags(flags);
        setUserProfilePics(profilePics);
        roomsHook.setRooms(roomsData);
        authenticatedProjectRef.current = true;
        initialized = true;

        await cacheChatSnapshot({
          projectId,
          cachedAt: Date.now(),
          currentUser: user.username,
          currentUserAliases: user.aliases || [],
          users: uniqueUsersByKey(members),
          rooms: roomsData,
          featureFlags: flags,
          userProfilePics: profilePics,
          teamMessages: messagesHook.messages,
          roomMessages: messagesHook.roomMessages,
          privateMessages: messagesHook.privateMessages,
        });

        await Promise.all([
          messagesHook.loadTeamHistory(),
          unreadHook.loadSummaries(),
          presenceHook.loadPresence(),
        ]);
      } catch (err) {
        console.error('[Chat] init failed', err);
        authenticatedProjectRef.current = false;
        if (!cancelled && hadCachedMessages) {
          const cached = await loadCachedChat(projectId);
          currentUserRef.current = (cached?.currentUser || '').toLowerCase();
          setCurrentUser(cached?.currentUser || '');
          setCurrentUserAliases(cached?.currentUserAliases || []);
          setUsers(uniqueUsersByKey(cached?.users || []));
          setFeatureFlags(cached?.featureFlags || featureFlags);
          setUserProfilePics(cached?.userProfilePics || {});
          roomsHook.setRooms(cached?.rooms || []);
          authenticatedProjectRef.current = true;
          initialized = false;
          setError('Offline. Showing cached chat messages.');
        } else if (!cancelled) {
          setError('You do not have access to this project chat.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          // Connect after HTTP init so any token refresh has already completed.
          if (initialized) {
            connectWebSocket();
          }
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      authenticatedProjectRef.current = false;
      shouldReconnectRef.current = false;
      stompConnectedRef.current = false;
      isConnectingRef.current = false;
      reconnectAttemptRef.current = 0;
      const dying = socketRef.current;
      socketRef.current = null;
      dying?.close();
      clearSubscribedRooms();
      clearReconnectTimer();
      clearTokenRefreshTimer();
    };
  // The initialization lifecycle is intentionally keyed to project changes only.
  // The hook modules expose stable operational callbacks for this flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Send helpers ──────────────────────────────────────────────────────────
  const stompSend = useCallback((dest: string, body: string) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Not connected. Message will be queued.');
      return false;
    }
    sendStompFrame(ws, buildSend(dest, body));
    return true;
  }, []);

  const sendMessage = useCallback((content: string, recipient?: string | null) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const localId = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (recipient) {
      const msg: ChatMessage = {
        localId, sender: currentUserRef.current, content: trimmed,
        recipient, type: 'CHAT', formatType: 'PLAIN',
        timestamp: new Date().toISOString(),
        syncStatus: isSocketConnected ? 'sent' : 'pending',
        offlineQueued: !isSocketConnected,
      };
      const sent = isSocketConnected && stompSend(`/app/project/${projectId}/chat.sendPrivateMessage`, JSON.stringify(msg));
      // Optimistic update
      messagesHook.addPrivateMessage(recipient, msg);
      unreadHook.setPrivateLastMessages(prev => ({ ...prev, [dmKey(recipient)]: msg }));
      if (!sent) {
        void enqueueChatMessage({
          projectId,
          localId,
          scope: { type: 'PRIVATE', recipient },
          content: trimmed,
          sender: currentUserRef.current,
          createdAt: msg.timestamp!,
          baseLastMessageId: getActiveLastMessageId(undefined, recipient),
        });
      }
    } else {
      const msg: ChatMessage = {
        localId, sender: currentUserRef.current, content: trimmed,
        type: 'CHAT', formatType: 'PLAIN',
        timestamp: new Date().toISOString(),
        syncStatus: isSocketConnected ? 'sent' : 'pending',
        offlineQueued: !isSocketConnected,
      };
      const sent = isSocketConnected && stompSend(`/app/project/${projectId}/chat.sendMessage`, JSON.stringify(msg));
      messagesHook.addTeamMessage(msg);
      if (!sent) {
        void enqueueChatMessage({
          projectId,
          localId,
          scope: { type: 'TEAM' },
          content: trimmed,
          sender: currentUserRef.current,
          createdAt: msg.timestamp!,
          baseLastMessageId: getActiveLastMessageId(),
        });
      }
    }
  }, [getActiveLastMessageId, isSocketConnected, projectId, stompSend, messagesHook, unreadHook]);

  const sendRoomMessage = useCallback((content: string, roomId: number) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const localId = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const msg: ChatMessage = {
      localId, sender: currentUserRef.current, content: trimmed,
      roomId, type: 'CHAT', formatType: 'PLAIN',
      timestamp: new Date().toISOString(),
      syncStatus: isSocketConnected ? 'sent' : 'pending',
      offlineQueued: !isSocketConnected,
    };
    const sent = isSocketConnected && stompSend(`/app/project/${projectId}/room/${roomId}/send`, JSON.stringify(msg));
    messagesHook.addRoomMessage(roomId, msg);
    if (!sent) {
      void enqueueChatMessage({
        projectId,
        localId,
        scope: { type: 'ROOM', roomId },
        content: trimmed,
        sender: currentUserRef.current,
        createdAt: msg.timestamp!,
        baseLastMessageId: getActiveLastMessageId(roomId),
      });
    }
  }, [getActiveLastMessageId, isSocketConnected, projectId, stompSend, messagesHook]);

  const sendTyping = useCallback((isTyping: boolean) => {
    const body = JSON.stringify({
      isTyping,
      scope: selectedRoomIdRef.current !== null ? 'ROOM' : selectedUserRef.current ? 'PRIVATE' : 'TEAM',
      roomId: selectedRoomIdRef.current ?? undefined,
      recipient: selectedUserRef.current ?? undefined,
    });
    stompSend(`/app/project/${projectId}/typing`, body);
  }, [projectId, stompSend]);

  const toggleReaction = useCallback((messageId: number, emoji: string) => {
    const ws = socketRef.current;
    const canUseStomp = isSocketConnected && ws?.readyState === WebSocket.OPEN;
    return reactionsHook.toggleReaction(messageId, emoji, canUseStomp ? stompSend : undefined);
  }, [isSocketConnected, reactionsHook, stompSend]);

  // ── Selection actions ─────────────────────────────────────────────────────
  const selectPrivateUser = useCallback((user: string | null) => {
    const displayUser = user ? usersRef.current.find(u => dmKey(u) === dmKey(user)) || user : null;
    setSelectedUser(displayUser);
    if (displayUser) {
      selectRoom(null);
      messagesHook.loadPrivateHistory(displayUser);
      chatService.markPrivateRead(projectId, displayUser).catch(() => {});
      unreadHook.setPrivateUnseenCounts(prev => ({ ...prev, [dmKey(displayUser)]: 0 }));
    }
  }, [projectId, selectRoom, messagesHook, unreadHook]);

  const handleSelectRoom = useCallback((id: number | null) => {
    selectRoom(id);
    if (id !== null) {
      setSelectedUser(null);
      messagesHook.loadRoomHistory(id);
      chatService.markRoomRead(projectId, id).catch(() => {});
      unreadHook.setRoomUnseenCounts(prev => ({ ...prev, [id]: 0 }));
      // Subscribe if we have an open socket
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        subscribeRoom(socketRef.current, id);
      }
    }
  }, [projectId, selectRoom, messagesHook, unreadHook, subscribeRoom]);

  return {
    currentUser, currentUserAliases, users, userProfilePics,
    selectedUser, selectedRoomId,
    messages: messagesHook.messages,
    privateMessages: messagesHook.privateMessages,
    roomMessages: messagesHook.roomMessages,
    rooms,
    privateUnseenCounts: unreadHook.privateUnseenCounts,
    roomUnseenCounts: unreadHook.roomUnseenCounts,
    privateLastMessages: unreadHook.privateLastMessages,
    roomLastMessages: unreadHook.roomLastMessages,
    teamUnseenCount: unreadHook.teamUnseenCount,
    teamLastMessage: unreadHook.teamLastMessage,
    teamMentionCount: unreadHook.teamMentionCount,
    roomMentionCounts: unreadHook.roomMentionCounts,
    onlineUsers: presenceHook.onlineUsers,
    teamTypingUsers: presenceHook.teamTypingUsers,
    roomTypingUsers: presenceHook.roomTypingUsers,
    privateTypingUsers: presenceHook.privateTypingUsers,
    featureFlags,
    searchResults: searchHook.searchResults,
    isSearchLoading: searchHook.isSearchLoading,
    messageReactions: reactionsHook.messageReactions,
    activeThreadRoot: threadsHook.activeThreadRoot,
    threadMessages: threadsHook.threadMessages,
    isLoading, isSocketConnected, isNetworkOnline, error,
    hasStaleCachedMessages: messagesHook.hasStaleCache,
    queuedChatCount, failedChatCount, serverChangedWhileOffline,
    selectPrivateUser,
    selectRoom: handleSelectRoom,
    sendMessage, sendRoomMessage,
    sendThreadReply: threadsHook.sendThreadReply,
    openThread: threadsHook.openThread,
    closeThread: threadsHook.closeThread,
    editMessage: messagesHook.editMessage,
    deleteMessage: messagesHook.deleteMessage,
    toggleReaction,
    loadPrivateHistory: messagesHook.loadPrivateHistory,
    loadRoomHistory: messagesHook.loadRoomHistory,
    createRoom: roomsHook.createRoom,
    deleteRoom: roomsHook.deleteRoom,
    updateRoomMeta: roomsHook.updateRoomMeta,
    pinRoomMessage: roomsHook.pinRoomMessage,
    sendTyping,
    searchMessages: searchHook.searchMessages,
    trackTelemetry: chatService.postTelemetry,
    retryConnection: connectWebSocket,
  };
}
