import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ensureValidToken } from '../auth/storage';
import { buildWebSocketUrl } from '../api/baseUrl';
import { offlineSyncManager } from '../services/offlineSyncManager';
import {
  buildStompConnect,
  buildStompSubscribe,
  parseStompFrame,
  readWebSocketPayload,
  sendStompFrame,
} from '../realtime/stompFrames';

export interface GitHubPrEvent { type: 'opened' | 'merged' | 'closed'; prNumber: number; prTitle: string; prUrl: string; authorLogin: string }
export interface GitHubCiEvent { workflow: string; branch: string; status: 'success' | 'failure' | 'running'; commitSha: string }
export interface GitHubIssueEvent { action: 'opened' | 'closed' | 'labeled' | 'assigned'; issueNumber: number; issueTitle: string; actorLogin: string }
export interface GitHubTaskBadgeEvent { taskId: number; githubIssueNumber: number; githubRepoFullName: string; issueState: 'open' | 'closed' }

interface GitHubRealtimeHandlers {
  onPullRequest?: (event: GitHubPrEvent) => void;
  onCi?: (event: GitHubCiEvent) => void;
  onIssue?: (event: GitHubIssueEvent) => void;
  onTaskBadge?: (event: GitHubTaskBadgeEvent) => void;
}

const TOPICS = ['prs', 'ci', 'issues', 'task-badges'] as const;

export function useGitHubRealtime(projectId: string, handlers: GitHubRealtimeHandlers) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const activeRef = useRef(true);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const disconnect = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    setConnected(false);
  }, []);

  const connect = useCallback(async () => {
    if (!projectId || !activeRef.current || !offlineSyncManager.getOnlineStatus()) return;
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;
    const token = await ensureValidToken();
    if (!token || !activeRef.current) return;
    const socket = new WebSocket(buildWebSocketUrl());
    socketRef.current = socket;

    const scheduleRetry = () => {
      if (!activeRef.current || retryRef.current) return;
      const delay = Math.min(30_000, 1000 * 2 ** attemptsRef.current++);
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        void connect();
      }, delay);
    };

    socket.onopen = () => sendStompFrame(socket, buildStompConnect(token));
    socket.onmessage = async message => {
      try {
        const frame = parseStompFrame(await readWebSocketPayload(message.data));
        if (frame.command === 'CONNECTED') {
          attemptsRef.current = 0;
          setConnected(true);
          setError(null);
          TOPICS.forEach(topic => sendStompFrame(
            socket,
            buildStompSubscribe(`github-${topic}`, `/topic/projects/${projectId}/github/${topic}`),
          ));
          return;
        }
        if (frame.command === 'ERROR') throw new Error(frame.body || 'Realtime connection failed');
        if (frame.command !== 'MESSAGE') return;
        const destination = frame.headers.destination ?? '';
        const payload = JSON.parse(frame.body);
        if (destination.endsWith('/prs')) handlersRef.current.onPullRequest?.(payload);
        else if (destination.endsWith('/ci')) handlersRef.current.onCi?.(payload);
        else if (destination.endsWith('/issues')) handlersRef.current.onIssue?.(payload);
        else if (destination.endsWith('/task-badges')) handlersRef.current.onTaskBadge?.(payload);
      } catch {
        setError('Live GitHub updates are temporarily unavailable.');
      }
    };
    socket.onerror = () => setError('Live GitHub updates are temporarily unavailable.');
    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      setConnected(false);
      scheduleRetry();
    };
  }, [projectId]);

  useEffect(() => {
    activeRef.current = true;
    void connect();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void connect();
      else disconnect();
    });
    const removeNetwork = offlineSyncManager.addListener(event => {
      if (event.type !== 'CONNECTION_CHANGED') return;
      if (event.isOnline) void connect();
      else disconnect();
    });
    return () => {
      activeRef.current = false;
      appState.remove();
      removeNetwork();
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, error, reconnect: connect };
}
