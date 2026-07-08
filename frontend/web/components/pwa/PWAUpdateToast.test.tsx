import { act, render } from '@testing-library/react';
import { toast } from '@/components/ui/Toast';
import PWAUpdateToast from './PWAUpdateToast';
import { PWA_UPDATE_AVAILABLE_EVENT } from './PWARegistration';

jest.mock('@/components/ui/Toast', () => ({
  toast: jest.fn(),
}));

const mockedToast = toast as jest.MockedFunction<typeof toast>;

describe('PWAUpdateToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });
  });

  it('shows an update toast and tells the waiting worker to skip waiting', () => {
    const postMessage = jest.fn();
    const registration = {
      waiting: { postMessage },
    } as unknown as ServiceWorkerRegistration;

    render(<PWAUpdateToast />);

    act(() => {
      window.dispatchEvent(new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, {
        detail: { registration },
      }));
    });

    expect(mockedToast).toHaveBeenCalledWith(
      'Update available',
      'info',
      600_000,
      'Refresh',
      expect.any(Function),
    );

    const applyUpdate = mockedToast.mock.calls[0][4] as () => void;
    applyUpdate();

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
