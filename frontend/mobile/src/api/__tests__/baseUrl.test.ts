async function loadResolver(options: {
  apiUrl?: string;
  apiBaseUrl?: string;
  hostUri?: string;
  os: 'android' | 'ios' | 'web';
  environment?: 'development' | 'preview' | 'production' | 'test';
}) {
  jest.resetModules();
  if (options.apiUrl !== undefined) {
    process.env.EXPO_PUBLIC_API_URL = options.apiUrl;
  }
  if (options.apiBaseUrl !== undefined) {
    process.env.EXPO_PUBLIC_API_BASE_URL = options.apiBaseUrl;
  }
  if (options.environment !== undefined) {
    process.env.EXPO_PUBLIC_APP_ENV = options.environment;
  }

  jest.doMock('react-native', () => ({
    Platform: { OS: options.os },
  }));

  jest.doMock('expo-constants', () => ({
    __esModule: true,
    default: {
      expoConfig: { hostUri: options.hostUri },
      manifest: {},
      manifest2: {},
    },
  }));

  return import('../baseUrl');
}

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_APP_ENV;
    jest.resetModules();
  });

  test('keeps configured URL on web', async () => {
    const { buildApiUrl, resolveApiBaseUrl } = await loadResolver({
      apiUrl: 'http://localhost:8080',
      os: 'web',
    });

    expect(resolveApiBaseUrl()).toBe('http://localhost:8080');
    expect(buildApiUrl('/api/auth/refresh')).toBe('http://localhost:8080/api/auth/refresh');
  });

  test('maps localhost to Expo dev host on physical Expo devices', async () => {
    const { resolveApiBaseUrl } = await loadResolver({
      apiUrl: 'http://localhost:8080',
      hostUri: '192.168.1.20:8081',
      os: 'ios',
    });

    expect(resolveApiBaseUrl()).toBe('http://192.168.1.20:8080');
  });

  test('maps Android localhost to emulator host when no Expo dev host exists', async () => {
    const { resolveApiBaseUrl } = await loadResolver({
      apiUrl: 'http://127.0.0.1:8080',
      os: 'android',
    });

    expect(resolveApiBaseUrl()).toBe('http://10.0.2.2:8080');
  });

  test('keeps localhost for iOS simulator when no Expo dev host exists', async () => {
    const { resolveApiBaseUrl } = await loadResolver({
      apiUrl: 'http://127.0.0.1:8080',
      os: 'ios',
    });

    expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:8080');
  });

  test('prefers EXPO_PUBLIC_API_BASE_URL over EXPO_PUBLIC_API_URL', async () => {
    const { resolveApiBaseUrl } = await loadResolver({
      apiUrl: 'http://localhost:8080',
      apiBaseUrl: 'https://api.example.com',
      os: 'ios',
    });

    expect(resolveApiBaseUrl()).toBe('https://api.example.com');
  });

  test('builds relative API paths when no base URL is configured', async () => {
    const { buildApiUrl } = await loadResolver({
      os: 'web',
    });

    expect(buildApiUrl('api/auth/refresh')).toBe('/api/auth/refresh');
  });

  test('normalizes the configured origin and derives a secure WebSocket URL', async () => {
    const { buildApiUrl, buildWebSocketUrl, resolveApiBaseUrl } = await loadResolver({
      apiBaseUrl: 'https://api.example.com/',
      environment: 'preview',
      os: 'android',
    });

    expect(resolveApiBaseUrl()).toBe('https://api.example.com');
    expect(buildApiUrl('/api/projects')).toBe('https://api.example.com/api/projects');
    expect(buildWebSocketUrl()).toBe('wss://api.example.com/ws-native');
  });

  test.each([
    ['', 'required'],
    ['http://api.example.com', 'HTTPS'],
    ['https://localhost:8080', 'local API host'],
  ])('rejects unsafe preview URL %s', async (apiBaseUrl, message) => {
    await expect(loadResolver({
      apiBaseUrl,
      environment: 'preview',
      os: 'android',
    })).rejects.toThrow(message);
  });
});
