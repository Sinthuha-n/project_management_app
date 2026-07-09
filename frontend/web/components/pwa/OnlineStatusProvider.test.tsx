import { act, render, screen } from '@testing-library/react';
import { toast } from '@/components/ui/Toast';
import { OnlineStatusProvider, useOnlineStatus } from './OnlineStatusProvider';

jest.mock('@/components/ui/Toast', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    warning: jest.fn(),
  }),
}));

const mockedToast = toast as jest.MockedFunction<typeof toast> & {
  success: jest.Mock;
  warning: jest.Mock;
};

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

function StatusConsumer() {
  const { isOnline, isOffline } = useOnlineStatus();
  return <div data-testid="status">{isOnline ? 'online' : isOffline ? 'offline' : 'unknown'}</div>;
}

describe('OnlineStatusProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNavigatorOnline(true);
  });

  it('exposes online status to consumers', () => {
    render(
      <OnlineStatusProvider>
        <StatusConsumer />
      </OnlineStatusProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('online');
  });

  it('shows offline banner and toast when connection drops', () => {
    render(
      <OnlineStatusProvider>
        <StatusConsumer />
      </OnlineStatusProvider>,
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('offline');
    expect(screen.getByRole('status')).toHaveTextContent('Offline mode.');
    expect(mockedToast.warning).toHaveBeenCalledWith(
      'You are offline. Cached workspace data is read-only.',
      8000,
    );
  });

  it('announces reconnection', () => {
    render(
      <OnlineStatusProvider>
        <StatusConsumer />
      </OnlineStatusProvider>,
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('status')).toHaveTextContent('online');
    expect(mockedToast.success).toHaveBeenCalledWith('Back online. Refreshing workspace data.', 5000);
  });
});
