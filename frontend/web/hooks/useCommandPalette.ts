'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';
import { useProjectStore } from '@/stores/project-store';

export interface TaskResult {
    id: number;
    title: string;
    subtitle?: string;    // task key, e.g. "PROJ-42"
    projectName?: string;
    status: string;
    priority?: string;
    projectId?: number;
}

const ROLE_LEVELS: Record<string, number> = {
    VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3,
};

export function hasMinRole(userRole: string | null, minRole: string): boolean {
    if (!userRole) return false;
    return (ROLE_LEVELS[userRole.toUpperCase()] ?? 0) >= (ROLE_LEVELS[minRole.toUpperCase()] ?? 99);
}

function getScopedId(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('currentProjectId') || localStorage.getItem('currentProjectId');
}

export default function useCommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
    const [highlighted, setHighlighted] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Cache role per projectId to avoid repeated API calls
    const roleCache = useRef<Record<string, string>>({});

    const projects = useProjectStore((s) => s.projects);

    // Ctrl/Cmd+K toggle, Escape close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const fetchUserRole = useCallback(async (projectId: string) => {
        try {
            const tokenUser = getUserFromToken();
            if (!tokenUser) return;
            const res = await api.get<Array<{ userId: number; email: string; role: string }>>(
                `/api/projects/${projectId}/members`
            );
            const me = (res.data ?? []).find(
                (m) =>
                    (tokenUser.userId && m.userId === tokenUser.userId) ||
                    (tokenUser.email && m.email?.toLowerCase() === tokenUser.email.toLowerCase())
            );
            if (me?.role) {
                roleCache.current[projectId] = me.role;
                setUserRole(me.role);
            }
        } catch {
            // silent — role stays null, role-gated commands hidden
        }
    }, []);

    // Reset state and fetch role when palette opens
    useEffect(() => {
        if (!open) return;
        queueMicrotask(() => {
            setQuery('');
            setTaskResults([]);
            setHighlighted(0);
            requestAnimationFrame(() => inputRef.current?.focus());

            const projectId = getScopedId();
            if (projectId && projectId !== 'null') {
                const cached = roleCache.current[projectId];
                if (cached) {
                    setUserRole(cached);
                } else {
                    void fetchUserRole(projectId);
                }
            } else {
                setUserRole(null);
            }
        });
    }, [open, fetchUserRole]);

    const search = useCallback(async (q: string) => {
        const projectId = getScopedId();
        if (!q.trim() || q.length < 2 || !projectId || projectId === 'null') {
            setTaskResults([]);
            return;
        }
        setIsSearching(true);
        try {
            // Primary: debounced backend search (searches by title and key)
            const res = await api.get<{ tasks?: TaskResult[] }>(
                `/api/search?q=${encodeURIComponent(q)}&projectId=${projectId}`
            );
            setTaskResults((res.data?.tasks ?? []).slice(0, 10));
        } catch {
            // Fallback: fetch all tasks and filter client-side
            try {
                const fallback = await api.get<TaskResult[]>(
                    `/api/tasks/project/${projectId}/all`
                );
                const lower = q.toLowerCase();
                setTaskResults(
                    (fallback.data ?? [])
                        .filter((t) => t.title.toLowerCase().includes(lower))
                        .slice(0, 10)
                );
            } catch {
                setTaskResults([]);
            }
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounced search — fires 300ms after the query settles
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (query.length >= 2) {
            searchTimer.current = setTimeout(() => { void search(query); }, 300);
        } else {
            queueMicrotask(() => setTaskResults([]));
        }
        return () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        };
    }, [query, search]);

    const openTask = useCallback((id: number) => {
        setSelectedTaskId(id);
        setOpen(false);
    }, []);

    return {
        open, setOpen,
        query, setQuery,
        taskResults,
        highlighted, setHighlighted,
        isSearching,
        selectedTaskId, setSelectedTaskId,
        inputRef,
        openTask,
        userRole,
        projects,
    };
}
