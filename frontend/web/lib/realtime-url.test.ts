import { resolveWebSocketBaseUrl } from './realtime-url';

describe('resolveWebSocketBaseUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PHASE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolves the URL correctly when NEXT_PUBLIC_WS_BASE_URL is set (https -> wss)', () => {
    process.env.NEXT_PUBLIC_WS_BASE_URL = 'https://api.example.com';
    expect(resolveWebSocketBaseUrl('http://localhost:8080')).toBe('wss://api.example.com');
  });

  it('resolves the URL correctly when NEXT_PUBLIC_WS_BASE_URL is set (http -> ws)', () => {
    process.env.NEXT_PUBLIC_WS_BASE_URL = 'http://api.example.com';
    expect(resolveWebSocketBaseUrl('http://localhost:8080')).toBe('ws://api.example.com');
  });

  it('resolves localhost to ws even if port or path differs', () => {
    process.env.NEXT_PUBLIC_WS_BASE_URL = 'http://localhost:3000/some/path';
    expect(resolveWebSocketBaseUrl('http://localhost:8080')).toBe('ws://localhost:3000/some/path');
  });

  it('falls back to backendUrl in development when NEXT_PUBLIC_WS_BASE_URL is missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    expect(resolveWebSocketBaseUrl('https://api.example.com')).toBe('wss://api.example.com');
  });

  it('falls back to default localhost in development when both NEXT_PUBLIC_WS_BASE_URL and backendUrl are missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    expect(resolveWebSocketBaseUrl('')).toBe('ws://localhost:8080');
  });

  it('falls back to backendUrl in production when NEXT_PUBLIC_WS_BASE_URL is missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    expect(resolveWebSocketBaseUrl('https://api.example.com')).toBe('wss://api.example.com');
  });

  it('falls back to NEXT_PUBLIC_API_BASE_URL in production when the WebSocket URL is missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    expect(resolveWebSocketBaseUrl('')).toBe('wss://api.example.com');
  });

  it('throws in production when no public or fallback backend URL is available', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    expect(() => resolveWebSocketBaseUrl('')).toThrow(
      'WebSocket backend URL is missing. Set NEXT_PUBLIC_WS_BASE_URL to the deployed backend origin.'
    );
  });

  it('falls back to backendUrl during Next production build when NEXT_PUBLIC_WS_BASE_URL is missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.NEXT_PUBLIC_WS_BASE_URL;
    expect(resolveWebSocketBaseUrl('https://api.example.com')).toBe('wss://api.example.com');
  });
});
