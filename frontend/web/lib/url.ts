/**
 * Removes a query parameter from the current URL without adding a history entry.
 * No-ops during server-side rendering.
 */
export function stripQueryParam(param: string): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has(param)) return;

  url.searchParams.delete(param);
  window.history.replaceState({}, '', url.toString());
}
