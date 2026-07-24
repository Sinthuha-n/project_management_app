import { getApiErrorStatus, getApiRequestId, getApiRetryAfterSeconds, normalizeApiError } from './api-error';

export type ApiFailure = {
  status?: number;
  code?: string;
  message: string;
  requestId?: string;
  retryAfterSeconds?: number;
};

export type ClientDiagnosticEvent = {
  route: string;
  operation: 'auth' | 'upload' | 'mutation' | 'realtime' | 'read';
  status?: number;
  errorCode?: string;
  requestId?: string;
  retryAfterSeconds?: number;
};

function errorCode(error: unknown): string | undefined {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== 'object') return undefined;
  const value = (data as Record<string, unknown>).errorCode ?? (data as Record<string, unknown>).code;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function toApiFailure(error: unknown, fallback: string): ApiFailure {
  return {
    status: getApiErrorStatus(error),
    code: errorCode(error),
    message: normalizeApiError(error, fallback),
    requestId: getApiRequestId(error),
    retryAfterSeconds: getApiRetryAfterSeconds(error),
  };
}

/** Never include payloads, credentials, OTPs, or presigned URLs in this event. */
export function reportClientFailure(event: ClientDiagnosticEvent): void {
  if (process.env.NODE_ENV !== 'production') console.warn('[client-failure]', event);
}

export function failureAction(failure: ApiFailure): 'signin' | 'forbidden' | 'reload' | 'reduce-upload' | 'cooldown' | 'unavailable' | 'none' {
  switch (failure.status) {
    case 401: return 'signin';
    case 403: case 404: return 'forbidden';
    case 409: return 'reload';
    case 413: return 'reduce-upload';
    case 429: return 'cooldown';
    case 503: return 'unavailable';
    default: return 'none';
  }
}
