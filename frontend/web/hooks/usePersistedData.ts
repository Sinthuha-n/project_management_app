'use client';

/**
 * usePersistedData — stale-while-revalidate cache that persists in localStorage
 * until the user logs out. Syncs in the background every `syncIntervalMs` ms.
 *
 * Cache entries are keyed by a user-scoped token, so different users on the
 * same device never share data. clearAllSessionCacheData() is called on logout.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  buildSessionCacheKey,
  getSessionCache,
  setSessionCache,
} from '@/lib/session-cache';

interface UsePersistedDataOptions<T> {
  /** Unique page / feature identifier e.g. 'kanban-board' */
  cacheKey: string;
  /** Additional scope parts (e.g. projectId, roomId) */
  scope?: Array<string | number | null | undefined>;
  /** The async function that fetches fresh data */
  fetcher: () => Promise<T>;
  /** How long before cache is considered stale (default 60s) */
  ttlMs?: number;
  /** How often to silently re-fetch in the background (default 30s). Set 0 to disable. */
  syncIntervalMs?: number;
  /** Whether to skip fetching entirely */
  skip?: boolean;
}

interface UsePersistedDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePersistedData<T>({
  cacheKey,
  scope = [],
  fetcher,
  ttlMs = 60_000,
  syncIntervalMs = 30_000,
  skip = false,
}: UsePersistedDataOptions<T>): UsePersistedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const requestGenerationRef = useRef(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const scopeKey = useMemo(() => JSON.stringify(scope), [scope]);

  const getKey = useCallback(() => {
    return buildSessionCacheKey(cacheKey, JSON.parse(scopeKey) as typeof scope);
  }, [cacheKey, scopeKey]);

  const fetchAndCache = useCallback(async (showLoading = false) => {
    const key = getKey();
    if (!key) return;
    const requestGeneration = ++requestGenerationRef.current;
    if (showLoading) setLoading(true);
    try {
      const fresh = await fetcherRef.current();
      if (requestGeneration !== requestGenerationRef.current) return;
      hasDataRef.current = true;
      setData(fresh);
      setError(null);
      setSessionCache(key, fresh, ttlMs);
    } catch (err) {
      if (requestGeneration !== requestGenerationRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      // Only surface the error if we have nothing cached yet
      if (!hasDataRef.current) setError(msg);
    } finally {
      if (showLoading && requestGeneration === requestGenerationRef.current) setLoading(false);
    }
  }, [getKey, ttlMs]);

  // Initial load: serve cache instantly, then revalidate
  useEffect(() => {
    requestGenerationRef.current += 1;
    hasDataRef.current = false;
    setData(null);
    setError(null);
    if (skip) { setLoading(false); return; }

    const key = getKey();
    if (!key) { setLoading(false); return; }
    setLoading(true);

    const cached = getSessionCache<T>(key, { allowStale: true });
    if (cached.data !== null) {
      hasDataRef.current = true;
      setData(cached.data);
      setLoading(false);
      // Revalidate silently if stale
      if (cached.isStale) void fetchAndCache(false);
    } else {
      void fetchAndCache(true);
    }
  }, [skip, getKey, fetchAndCache]);

  // Background sync
  useEffect(() => {
    if (skip || syncIntervalMs <= 0) return;
    const id = setInterval(() => void fetchAndCache(false), syncIntervalMs);
    return () => clearInterval(id);
  }, [skip, syncIntervalMs, fetchAndCache]);

  const refresh = useCallback(() => fetchAndCache(true), [fetchAndCache]);

  return { data, loading, error, refresh };
}
