export function apiErrorMessage(error: unknown, fallback: string) {
  const code = (error as { code?: string })?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return 'The server took too long to respond. Check your connection and try again.';
  }

  const requestError = error as { request?: unknown; response?: unknown };
  if ((requestError.request && !requestError.response) || code === 'ERR_NETWORK') {
    return 'Cannot reach Planora. Check your internet connection and try again.';
  }

  if (error instanceof Error && error.message && !('response' in error)) {
    return error.message;
  }

  const response = (error as { response?: { data?: unknown } })?.response;
  const data = response?.data;

  if (typeof data === 'string' && data.trim()) return data;

  if (data && typeof data === 'object') {
    const body = data as {
      message?: string;
      fieldErrors?: { field?: string; message?: string }[];
    };

    if (Array.isArray(body.fieldErrors)) {
      const messages = body.fieldErrors
        .map((err) => {
          if (!err || typeof err !== 'object') return null;
          return typeof err.message === 'string' && err.message.trim() ? err.message : null;
        })
        .filter(Boolean);
      if (messages.length) return messages.join('\n');
    }

    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  }

  return fallback;
}

type ErrorWithHeaders = { response?: { headers?: Record<string, unknown> | { get?: (name: string) => unknown } } };

export function apiRetryAfterSeconds(error: unknown, now = Date.now()): number | undefined {
  const headers = (error as ErrorWithHeaders)?.response?.headers;
  if (!headers) return undefined;
  const value = typeof (headers as { get?: unknown }).get === 'function'
    ? (headers as { get: (name: string) => unknown }).get('retry-after')
    : (headers as Record<string, unknown>)['retry-after'] ?? (headers as Record<string, unknown>)['Retry-After'];
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (/^\d+$/.test(value)) return Math.min(Math.max(Number(value), 1), 86_400);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.min(Math.max(Math.ceil((timestamp - now) / 1000), 1), 86_400);
}

export function apiRequestId(error: unknown): string | undefined {
  const headers = (error as ErrorWithHeaders)?.response?.headers;
  if (!headers) return undefined;
  const value = typeof (headers as { get?: unknown }).get === 'function'
    ? (headers as { get: (name: string) => unknown }).get('x-request-id')
    : (headers as Record<string, unknown>)['x-request-id'] ?? (headers as Record<string, unknown>)['X-Request-Id'];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export type MobileApiFailure = {
  status?: number;
  code?: string;
  message: string;
  requestId?: string;
  retryAfterSeconds?: number;
};

export function mobileApiFailure(error: unknown, fallback: string): MobileApiFailure {
  const response = (error as { response?: { status?: unknown; data?: unknown } })?.response;
  const data = response?.data;
  const code = data && typeof data === 'object'
    ? (data as { errorCode?: unknown; code?: unknown }).errorCode ?? (data as { code?: unknown }).code
    : undefined;
  return {
    status: typeof response?.status === 'number' ? response.status : undefined,
    code: typeof code === 'string' ? code : undefined,
    message: apiErrorMessage(error, fallback),
    requestId: apiRequestId(error),
    retryAfterSeconds: apiRetryAfterSeconds(error),
  };
}

/** Development-only redacted diagnostics; do not pass URLs, payloads, or credentials. */
export function reportMobileFailure(event: { screen: string; operation: string; status?: number; code?: string; requestId?: string; retryAfterSeconds?: number }) {
  if (__DEV__) console.warn('[mobile-client-failure]', event);
}
