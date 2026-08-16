import axios from 'axios';

/** Retry only failures that can plausibly recover without changing the request. */
export function shouldRetrySWRRequest(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) {
    return true;
  }

  const { status } = error.response;
  return status === 408 || status === 429 || status >= 500;
}
