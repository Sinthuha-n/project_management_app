import { getApiBaseUrl } from './api-base-url';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

export interface WebSocketBaseUrlResolution {
  url: string;
  source: 'NEXT_PUBLIC_WS_BASE_URL' | 'NEXT_PUBLIC_API_BASE_URL' | 'NEXT_PUBLIC_BACKEND_URL' | 'backendUrl' | 'apiBaseUrl';
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')
}

/**
 * Resolves the WebSocket base URL for STOMP notifications and chat sync.
 * 
 * In production, it requires NEXT_PUBLIC_WS_BASE_URL to be set to the backend's direct
 * absolute URL (e.g. 'https://api.planora.com') and converts it to 'wss://api.planora.com'.
 * If the variable is missing in production runtime, it throws a hard-fail runtime error.
 * 
 * In development or during Next build phase, if NEXT_PUBLIC_WS_BASE_URL is missing,
 * it falls back to the backend URL passed in, then the shared API base URL,
 * converting it to a local 'ws://' endpoint when appropriate.
 */
export function resolveWebSocketBaseUrlDetails(backendUrl: string): WebSocketBaseUrlResolution {
  let wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL;
  let source: WebSocketBaseUrlResolution['source'] = 'NEXT_PUBLIC_WS_BASE_URL';

  if (!wsUrl) {
    wsUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    source = 'NEXT_PUBLIC_BACKEND_URL';
  }

  if (!wsUrl) {
    wsUrl = backendUrl;
    source = 'backendUrl';
  }

  if (!wsUrl) {
    wsUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    source = 'NEXT_PUBLIC_API_BASE_URL';
  }

  if (!wsUrl) {
    const isProdRuntime = process.env.NODE_ENV === 'production';
    const isNextProductionBuild = process.env.NEXT_PHASE === 'phase-production-build';
    const fallbackUrl = getApiBaseUrl();

    if (fallbackUrl) {
      wsUrl = fallbackUrl;
      source = 'apiBaseUrl';
    } else if (isProdRuntime && !isNextProductionBuild) {
      throw new Error(
        'WebSocket backend URL is missing. Set NEXT_PUBLIC_WS_BASE_URL to the deployed backend origin.',
      );
    } else {
      wsUrl = fallbackUrl;
      source = 'apiBaseUrl';
    }
  }

  const rawUrl = wsUrl.trim();

  if (!rawUrl) {
    throw new Error('WebSocket backend URL is empty.');
  }

  try {
    const url = new URL(rawUrl);

    if (isLocalHostname(url.hostname)) {
      url.protocol = 'ws:';
      return { url: url.toString().replace(/\/$/, ''), source };
    }

    if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    } else if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    }

    return { url: url.toString().replace(/\/$/, ''), source };
  } catch {
    return {
      url: rawUrl
        .replace(/^https:/i, 'wss:')
        .replace(/^http:/i, 'ws:')
        .replace(/\/$/, ''),
      source,
    };
  }
}

export function resolveWebSocketBaseUrl(backendUrl: string): string {
  return resolveWebSocketBaseUrlDetails(backendUrl).url;
}
