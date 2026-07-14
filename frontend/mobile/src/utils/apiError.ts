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
