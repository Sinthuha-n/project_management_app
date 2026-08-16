import { resolveProfilePhotoUrl } from './profile-photo';

describe('resolveProfilePhotoUrl', () => {
  const originalEnv = process.env;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns absolute and browser-native URLs unchanged', () => {
    expect(resolveProfilePhotoUrl('https://images.example.com/avatar.png')).toBe('https://images.example.com/avatar.png');
    expect(resolveProfilePhotoUrl('http://localhost:8080/uploads/avatar.png')).toBe('http://localhost:8080/uploads/avatar.png');
    expect(resolveProfilePhotoUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(resolveProfilePhotoUrl('blob:https://app.example.com/avatar')).toBe('blob:https://app.example.com/avatar');
  });

  it('resolves relative URLs against the configured API base URL', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com/';

    expect(resolveProfilePhotoUrl('/uploads/avatar.png')).toBe('https://api.example.com/uploads/avatar.png');
  });

  it('resolves relative URLs against localhost in development when API base URL is missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    delete process.env.NEXT_PUBLIC_API_BASE_URL;

    expect(resolveProfilePhotoUrl('/uploads/avatar.png')).toBe('http://localhost:8080/uploads/avatar.png');
  });

  it('keeps relative URLs relative in production when API base URL is missing', () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    delete process.env.NEXT_PUBLIC_API_BASE_URL;

    expect(resolveProfilePhotoUrl('/uploads/avatar.png')).toBe('/uploads/avatar.png');
  });

  it('returns null when photo url is missing, even if a user id is provided', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com';

    expect(resolveProfilePhotoUrl(null, 42)).toBeNull();
    expect(resolveProfilePhotoUrl(undefined, 42)).toBeNull();
    expect(resolveProfilePhotoUrl('', 42)).toBeNull();
  });

  it('returns null for empty values without a fallback user id', () => {
    expect(resolveProfilePhotoUrl(null)).toBeNull();
    expect(resolveProfilePhotoUrl(undefined)).toBeNull();
    expect(resolveProfilePhotoUrl('')).toBeNull();
  });
});
