export function apiErrorMessage(error: unknown, fallback: string) {
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
