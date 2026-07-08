import { render, waitFor } from '@testing-library/react';
import PWARegistration, {
  applyStandaloneMarker,
  shouldRegisterServiceWorker,
} from './PWARegistration';

describe('PWARegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('applies a standalone marker to the document element', () => {
    applyStandaloneMarker(true);

    expect(document.documentElement).toHaveAttribute('data-pwa-standalone', 'true');
    expect(document.documentElement).toHaveClass('pwa-standalone');

    applyStandaloneMarker(false);

    expect(document.documentElement).toHaveAttribute('data-pwa-standalone', 'false');
    expect(document.documentElement).not.toHaveClass('pwa-standalone');
  });
});
