'use client';

const CACHE_PREFIX = 'planora:session-cache:';
const CACHE_VERSION = 2;
const SESSION_META_KEY = `${CACHE_PREFIX}meta`;

export type SessionCacheEnvelope<T> = {
  version: number;
  savedAt: number;
  expiresAt: number;
  data: T;
};

export type SessionCacheScope = {
  userKey: string;
  sessionKey: string;
};

export type SessionCacheReadResult<T> = {
  data: T | null;
  isStale: boolean;
};

type JwtPayload = {
  sub?: string;
  exp?: number;
  jti?: string;
  userId?: number;
  id?: number;
};

function safeStorageGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore quota/storage availability errors.
  }
}

function safeStorageRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage availability errors.
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length < 2) return null;

    const base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

function normalizeUserKey(value?: string): string {
  if (!value) return 'anonymous';
  return value.trim().toLowerCase();
}

function sanitizeKeyPart(part: string | number): string {
  return String(part).trim().replace(/[^a-zA-Z0-9:_-]/g, '_');
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function computeStableUserKey(payload: JwtPayload): string | null {
  const identity = payload.userId ?? payload.id ?? payload.sub;
  if (identity === undefined || identity === null || String(identity).trim().length === 0) return null;
  return `u_${stableHash(normalizeUserKey(String(identity)))}`;
}

function readPersistedScope(): SessionCacheScope | null {
  if (typeof window === 'undefined') return null;

  const raw = safeStorageGet(localStorage, SESSION_META_KEY);
  if (!raw) return null;

  try {
    const meta = JSON.parse(raw) as Partial<SessionCacheScope> & { version?: number };
    if (
      meta.version !== CACHE_VERSION
      || !meta.userKey
      || !meta.sessionKey
    ) {
      safeStorageRemove(localStorage, SESSION_META_KEY);
      return null;
    }
    return {
      userKey: sanitizeKeyPart(meta.userKey),
      sessionKey: sanitizeKeyPart(meta.sessionKey),
    };
  } catch {
    safeStorageRemove(localStorage, SESSION_META_KEY);
    return null;
  }
}

function removeSessionCacheEntriesForOtherUsers(activeUserKey: string): void {
  if (typeof window === 'undefined') return;

  Object.keys(localStorage)
    .filter((key) => (
      key.startsWith(CACHE_PREFIX)
      && key !== SESSION_META_KEY
      && !key.startsWith(`${CACHE_PREFIX}${activeUserKey}:`)
    ))
    .forEach((key) => safeStorageRemove(localStorage, key));
}

export function resolveSessionCacheScope(tokenOverride?: string | null): SessionCacheScope | null {
  if (!tokenOverride) {
    return readPersistedScope();
  }

  const payload = decodeJwtPayload(tokenOverride);
  if (!payload || !payload.sub) return null;
  const userKey = computeStableUserKey(payload);
  if (!userKey) return null;

  return {
    userKey,
    sessionKey: 'stable',
  };
}

export function buildSessionCacheKey(
  page: string,
  scopeParts: Array<string | number | null | undefined> = [],
  tokenOverride?: string | null,
): string | null {
  const scope = resolveSessionCacheScope(tokenOverride);
  if (!scope) return null;

  const pagePart = sanitizeKeyPart(page);
  const scoped = scopeParts
    .filter((value): value is string | number => value !== null && value !== undefined && String(value).trim().length > 0)
    .map((value) => sanitizeKeyPart(value));

  const suffix = scoped.length > 0 ? `:${scoped.join(':')}` : '';
  return `${CACHE_PREFIX}${scope.userKey}:${scope.sessionKey}:${pagePart}${suffix}`;
}

export function initializeSessionCacheForCurrentAuth(tokenOverride?: string | null): void {
  if (typeof window === 'undefined') return;

  const scope = resolveSessionCacheScope(tokenOverride);
  if (!scope) return;

  const previousScope = readPersistedScope();
  if (previousScope && previousScope.userKey !== scope.userKey) {
    removeSessionCacheEntriesForOtherUsers(scope.userKey);
  }

  safeStorageSet(
    localStorage,
    SESSION_META_KEY,
    JSON.stringify({
      version: CACHE_VERSION,
      userKey: scope.userKey,
      sessionKey: scope.sessionKey,
      initializedAt: Date.now(),
    }),
  );
}

export function getSessionCache<T>(
  key: string,
  options: { allowStale?: boolean } = {},
): SessionCacheReadResult<T> {
  if (typeof window === 'undefined') {
    return { data: null, isStale: false };
  }

  const raw = safeStorageGet(localStorage, key);
  if (!raw) {
    return { data: null, isStale: false };
  }

  try {
    const parsed = JSON.parse(raw) as SessionCacheEnvelope<T>;
    if (
      !parsed
      || typeof parsed !== 'object'
      || parsed.version !== CACHE_VERSION
      || typeof parsed.savedAt !== 'number'
      || typeof parsed.expiresAt !== 'number'
      || !('data' in parsed)
    ) {
      safeStorageRemove(localStorage, key);
      return { data: null, isStale: false };
    }

    const isStale = Date.now() > parsed.expiresAt;
    if (isStale && !options.allowStale) {
      safeStorageRemove(localStorage, key);
      return { data: null, isStale: true };
    }

    return { data: parsed.data, isStale };
  } catch {
    safeStorageRemove(localStorage, key);
    return { data: null, isStale: false };
  }
}

export function setSessionCache<T>(key: string, data: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const envelope: SessionCacheEnvelope<T> = {
    version: CACHE_VERSION,
    savedAt: now,
    expiresAt: now + Math.max(1, ttlMs),
    data,
  };

  safeStorageSet(localStorage, key, JSON.stringify(envelope));
}

export function removeSessionCache(key: string): void {
  if (typeof window === 'undefined') return;
  safeStorageRemove(localStorage, key);
}

export function clearAllSessionCacheData(): void {
  if (typeof window === 'undefined') return;

  Object.keys(localStorage)
    .filter((key) => key.startsWith(CACHE_PREFIX) || key.startsWith('planora:'))
    .forEach((key) => safeStorageRemove(localStorage, key));

  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('planora:'))
    .forEach((key) => safeStorageRemove(sessionStorage, key));
}
