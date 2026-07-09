import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import IOSInstallPrompt, {
  isInstallPromptDismissed,
  isInstallPromptSuppressedPath,
  isIOSUserAgent,
  isSafariUserAgent,
  shouldShowIOSInstallPrompt,
} from './IOSInstallPrompt';

let currentPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const MAC_IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function mockNavigator(userAgent: string, maxTouchPoints = 0, standalone = false) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: standalone,
  });
}

describe('IOSInstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentPathname = '/dashboard';
    mockNavigator(IOS_SAFARI_UA, 1, false);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: false }),
    });
  });

  it('detects iOS Safari and excludes iOS third-party browsers', () => {
    expect(isIOSUserAgent(IOS_SAFARI_UA, 1)).toBe(true);
    expect(isIOSUserAgent(MAC_IPAD_UA, 5)).toBe(true);
    expect(isSafariUserAgent(IOS_SAFARI_UA)).toBe(true);
    expect(isSafariUserAgent(IOS_CHROME_UA)).toBe(false);
    expect(shouldShowIOSInstallPrompt(IOS_SAFARI_UA, 1)).toBe(true);
    expect(shouldShowIOSInstallPrompt(IOS_CHROME_UA, 1)).toBe(false);
  });

  it('tracks dismissal with a TTL and suppresses deep work routes', () => {
    expect(isInstallPromptSuppressedPath('/taskcard')).toBe(true);
    expect(isInstallPromptSuppressedPath('/report/12')).toBe(true);
    expect(isInstallPromptSuppressedPath('/pages/abc')).toBe(true);
    expect(isInstallPromptSuppressedPath('/dashboard')).toBe(false);

    window.localStorage.setItem('planora:pwa-ios-install-dismissed', String(Date.now() + 1000));
    expect(isInstallPromptDismissed()).toBe(true);

    window.localStorage.setItem('planora:pwa-ios-install-dismissed', String(Date.now() - 1000));
    expect(isInstallPromptDismissed()).toBe(false);
    expect(window.localStorage.getItem('planora:pwa-ios-install-dismissed')).toBeNull();
  });

  it('renders install guidance and stores dismissal', async () => {
    render(<IOSInstallPrompt />);

    await waitFor(() => {
      expect(screen.getByText('Install Planora')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Dismiss install prompt'));

    expect(screen.queryByText('Install Planora')).not.toBeInTheDocument();
    expect(Number(window.localStorage.getItem('planora:pwa-ios-install-dismissed'))).toBeGreaterThan(Date.now());
  });

  it('stays hidden when already running standalone', () => {
    mockNavigator(IOS_SAFARI_UA, 1, true);

    render(<IOSInstallPrompt />);

    expect(screen.queryByText('Install Planora')).not.toBeInTheDocument();
  });

  it('stays hidden on suppressed routes', async () => {
    currentPathname = '/report/123';

    render(<IOSInstallPrompt />);

    expect(screen.queryByText('Install Planora')).not.toBeInTheDocument();
  });
});
