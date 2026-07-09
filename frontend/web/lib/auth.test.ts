import { clearTokens, ensureValidToken, getRefreshToken, getValidToken, refreshAccessToken, saveRefreshToken, saveToken, setRememberMe } from './auth';

function createJwt(payload: Record<string, unknown>): string {
  const encodedPayload = window.btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `header.${encodedPayload}.signature`;
}

describe('auth requestRefreshAccessToken URL handling', () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    global.fetch = fetchMock as unknown as typeof fetch;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'planora:auth_sync',
      newValue: JSON.stringify({ type: 'logout' }),
    }));
    fetchMock.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('calls the backend base URL when NEXT_PUBLIC_API_BASE_URL is set', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';
    saveRefreshToken('mock-refresh-token');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-access-token', refreshToken: 'new-refresh-token' }),
    });

    const token = await refreshAccessToken();

    expect(token).toBe('new-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/auth/refresh');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  });

  it('falls back to localhost in development when NEXT_PUBLIC_API_BASE_URL is not set', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    saveRefreshToken('mock-refresh-token');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-access-token-dev' }),
    });

    const token = await refreshAccessToken();

    expect(token).toBe('new-access-token-dev');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/api/auth/refresh');
  });

  it('calls the relative proxy endpoint in production when NEXT_PUBLIC_API_BASE_URL is missing', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    saveRefreshToken('mock-refresh-token');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-access-token-prod' }),
    });

    const token = await refreshAccessToken();

    expect(token).toBe('new-access-token-prod');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
  });

  it('calls the relative proxy endpoint during Next production build when NEXT_PUBLIC_API_BASE_URL is missing', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    saveRefreshToken('mock-refresh-token');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-access-token-build' }),
    });

    const token = await refreshAccessToken();

    expect(token).toBe('new-access-token-build');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/refresh');
  });

  it('stores the refresh-cookie marker in localStorage so new tabs can refresh', () => {
    setRememberMe(false);

    saveRefreshToken('mock-refresh-token');

    expect(window.localStorage.getItem('planora:has_refresh_token')).toBe('true');
    expect(window.sessionStorage.getItem('planora:has_refresh_token')).toBeNull();
    expect(getRefreshToken()).toBe('true');
  });

  it('clears the in-memory access token when another tab logs out', () => {
    saveToken(createJwt({
      sub: 'person@example.com',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    }));
    expect(getValidToken()).toBeTruthy();

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'planora:auth_sync',
      newValue: JSON.stringify({ type: 'logout' }),
    }));

    expect(getValidToken()).toBeNull();
  });

  it('does not probe the refresh endpoint when the local marker is missing', async () => {
    saveRefreshToken('mock-refresh-token');
    window.localStorage.removeItem('planora:has_refresh_token');

    expect(getRefreshToken()).toBeNull();

    const token = await ensureValidToken({ allowCookieRefresh: true });

    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('planora:has_refresh_token')).toBeNull();
  });

  it('does not refresh from cookies after explicit logout', async () => {
    saveRefreshToken('mock-refresh-token');

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    clearTokens();
    fetchMock.mockClear();

    const token = await ensureValidToken({ allowCookieRefresh: true });

    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores an in-flight refresh response after logout', async () => {
    saveRefreshToken('mock-refresh-token');

    let resolveRefresh!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const refreshPromise = refreshAccessToken({ allowCookieRefresh: true });
    await Promise.resolve();

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    clearTokens();

    resolveRefresh({
      ok: true,
      status: 200,
      json: async () => ({
        token: createJwt({
          sub: 'person@example.com',
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
        }),
      }),
    });

    await expect(refreshPromise).rejects.toThrow('Token refresh cancelled during logout');
    expect(getValidToken()).toBeNull();
  });
});
