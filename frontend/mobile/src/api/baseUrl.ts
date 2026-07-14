import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = '8080';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

export type AppEnvironment = 'development' | 'preview' | 'production' | 'test';

function getAppEnvironment(): AppEnvironment {
  const value = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (value === 'preview' || value === 'production' || value === 'test') return value;
  return 'development';
}

export function validateApiBaseUrl(
  value: string,
  environment: AppEnvironment = getAppEnvironment(),
) {
  const normalized = value.trim().replace(/\/+$/, '');

  if (!normalized) {
    if (environment === 'development' || environment === 'test') return '';
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required for preview and production builds.');
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be an absolute http(s) URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be a credential-free http(s) URL.');
  }

  if (environment === 'preview' || environment === 'production') {
    if (parsed.protocol !== 'https:') {
      throw new Error('Preview and production API traffic must use HTTPS.');
    }
    if (LOCAL_HOSTS.has(parsed.hostname)) {
      throw new Error('Preview and production builds cannot use a local API host.');
    }
  }

  return normalized;
}

function getExpoDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  return typeof hostUri === 'string' ? hostUri.split(':')[0] : undefined;
}

export function resolveApiBaseUrl() {
  const configuredUrl = validateApiBaseUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || '',
  );

  if (!configuredUrl || Platform.OS === 'web') {
    return configuredUrl;
  }

  const isLocalhostUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredUrl);

  if (!isLocalhostUrl) {
    return configuredUrl;
  }

  const devHost = getExpoDevHost();

  if (devHost && devHost !== 'localhost' && devHost !== '127.0.0.1') {
    return configuredUrl.replace(/:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, `://${devHost}:${API_PORT}`);
  }

  if (Platform.OS === 'android') {
    return configuredUrl.replace(/:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, `://10.0.2.2:${API_PORT}`);
  }

  return configuredUrl;
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = resolveApiBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function buildWebSocketUrl(path = '/ws-native') {
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) throw new Error('A configured API base URL is required for realtime connections.');

  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = path.startsWith('/') ? path : `/${path}`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();
