import { getApiBaseUrl } from '@/lib/api-base-url';

const ABSOLUTE_URL_RE = /^(https?:|data:|blob:)/i;

export function resolveProfilePhotoUrl(
  value?: string | null,
  _userId?: number | string | null,
): string | null {
  if (value && ABSOLUTE_URL_RE.test(value)) {
    return value;
  }

  if (value?.startsWith('/')) {
    const baseUrl = getApiBaseUrl().replace(/\/$/, '');
    return `${baseUrl}${value}`;
  }

  return null;
}

