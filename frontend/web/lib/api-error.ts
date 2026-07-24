import axios from 'axios';

type ErrorData = Record<string, unknown> | string | null | undefined;

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Please sign in again to continue.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the latest saved data.',
  422: 'Please fix the highlighted fields and try again.',
  413: 'The request is too large. Reduce the upload or payload and try again.',
  429: 'Too many requests. Please wait before trying again.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  500: 'Something went wrong on the server. Please try again.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFetchResponse(error: unknown): error is Response {
  return typeof Response !== 'undefined' && error instanceof Response;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function collectValidationMessages(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const direct = getString(entry);
      if (direct) return [direct];
      if (isRecord(entry)) {
        return [
          getString(entry.message),
          getString(entry.defaultMessage),
          getString(entry.error),
        ].filter((message): message is string => Boolean(message));
      }
      return [];
    });
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) => {
      const direct = getString(entry);
      if (direct) return [direct];
      if (Array.isArray(entry)) return entry.map(getString).filter((message): message is string => Boolean(message));
      if (isRecord(entry)) {
        return [
          getString(entry.message),
          getString(entry.defaultMessage),
          getString(entry.error),
        ].filter((message): message is string => Boolean(message));
      }
      return [];
    });
  }

  return [];
}

function getResponseData(error: unknown): ErrorData {
  if (axios.isAxiosError(error)) {
    return error.response?.data as ErrorData;
  }

  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : undefined;
    return (error.data ?? error.body ?? error.responseBody ?? response?.data) as ErrorData;
  }

  return undefined;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }

  if (isFetchResponse(error)) {
    return error.status;
  }

  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : undefined;
    const status = error.status ?? error.statusCode ?? response?.status;
    return typeof status === 'number' ? status : undefined;
  }

  return undefined;
}

function getResponseHeader(error: unknown, name: string): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const headers = error.response?.headers;
  if (!headers) return undefined;
  const value = typeof headers.get === 'function' ? headers.get(name) : headers[name] ?? headers[name.toLowerCase()];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Returns a bounded server-directed cooldown in seconds, if one was supplied. */
export function getApiRetryAfterSeconds(error: unknown, now = Date.now()): number | undefined {
  const retryAfter = getResponseHeader(error, 'retry-after');
  if (!retryAfter) return undefined;
  if (/^\d+$/.test(retryAfter)) return Math.min(Math.max(Number(retryAfter), 1), 86_400);
  const retryAt = Date.parse(retryAfter);
  if (Number.isNaN(retryAt)) return undefined;
  return Math.min(Math.max(Math.ceil((retryAt - now) / 1000), 1), 86_400);
}

/** Safe to attach to diagnostics; callers must not attach request bodies or credentials. */
export function getApiRequestId(error: unknown): string | undefined {
  return getResponseHeader(error, 'x-request-id');
}

export function normalizeApiError(error: unknown, fallbackMessage: string): string {
  const data = getResponseData(error);

  if (typeof data === 'string') {
    return data.trim() || fallbackMessage;
  }

  if (isRecord(data)) {
    const validationMessages = [
      ...collectValidationMessages(data.fieldErrors),
      ...collectValidationMessages(data.fields),
      ...collectValidationMessages(data.errors),
      ...collectValidationMessages(data.validationErrors),
      ...collectValidationMessages(data.violations),
    ];
    if (validationMessages.length > 0) {
      return validationMessages.join(' ');
    }

    const directMessage =
      getString(data.message) ??
      getString(data.errorMessage) ??
      getString(data.error) ??
      getString(data.detail) ??
      getString(data.title);
    if (directMessage) {
      return directMessage;
    }
  }

  if (isFetchResponse(error)) {
    return STATUS_MESSAGES[error.status] ?? fallbackMessage;
  }

  const status = getApiErrorStatus(error);
  if (status && STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
