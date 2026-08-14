import { act, render, waitFor } from '@testing-library/react';
import PWARegistration, {
  applyStandaloneMarker,
  cleanupDevelopmentPwa,
  PWA_UPDATE_CHECK_INTERVAL_MS,
  shouldRegisterServiceWorker,
} from './PWARegistration';

describe('PWARegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('allows registration on HTTPS and localhost only', () => {
    expect(shouldRegisterServiceWorker({
      hasServiceWorker: true,
      protocol: 'https:',
      hostname: 'planora.example',
    })).toBe(true);
    expect(shouldRegisterServiceWorker({
      hasServiceWorker: true,
      protocol: 'http:',
      hostname: 'localhost',
    })).toBe(true);
    expect(shouldRegisterServiceWorker({
      hasServiceWorker: true,
      protocol: 'http:',
      hostname: 'planora.example',
    })).toBe(false);
    expect(shouldRegisterServiceWorker({
      hasServiceWorker: false,
      protocol: 'https:',
      hostname: 'planora.example',
    })).toBe(false);
    expect(shouldRegisterServiceWorker({
      hasServiceWorker: true,
      protocol: 'http:',
      hostname: 'localhost',
      environment: 'development',
    })).toBe(false);
  });

  it('removes stale Planora service workers and caches from local development', async () => {
    const unregister = jest.fn().mockResolvedValue(true);
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: jest.fn().mockResolvedValue([
          { scope: `${window.location.origin}/`, unregister },
          { scope: 'https://unrelated.example/', unregister: jest.fn() },
        ]),
      },
    });
    const deleteCache = jest.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: jest.fn().mockResolvedValue(['planora-pwa-v1-static', 'unrelated-cache']),
        delete: deleteCache,
      },
    });

    await cleanupDevelopmentPwa();

    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('planora-pwa-v1-static');
    expect(deleteCache).toHaveBeenCalledTimes(1);
  });

  it('registers the service worker after window load', async () => {
    const register = jest.fn().mockResolvedValue({});
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    render(<PWARegistration />);
    window.dispatchEvent(new Event('load'));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
    });
  });

  it('checks for service worker updates after registration, focus, visibility, and interval', async () => {
    jest.useFakeTimers();
    const update = jest.fn().mockResolvedValue(undefined);
    const register = jest.fn().mockResolvedValue({
      scope: '/',
      update,
      addEventListener: jest.fn(),
    });
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });

    render(<PWARegistration />);
    window.dispatchEvent(new Event('load'));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });

    window.dispatchEvent(new Event('focus'));
    expect(update).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(3);

    act(() => {
      jest.advanceTimersByTime(PWA_UPDATE_CHECK_INTERVAL_MS);
    });
    expect(update).toHaveBeenCalledTimes(4);
  });

  it('applies a standalone marker to the document element', () => {
    applyStandaloneMarker(true);

    expect(document.documentElement).toHaveAttribute('data-pwa-standalone', 'true');
    expect(document.documentElement).toHaveClass('pwa-standalone');

    applyStandaloneMarker(false);

    expect(document.documentElement).toHaveAttribute('data-pwa-standalone', 'false');
    expect(document.documentElement).not.toHaveClass('pwa-standalone');
  });
});
