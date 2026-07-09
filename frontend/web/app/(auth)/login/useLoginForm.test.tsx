import { act, renderHook, waitFor } from '@testing-library/react';
import { useLoginForm } from './useLoginForm';
import { authApi } from '@/services/api-contract';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn(() => null) }),
}));

jest.mock('@/lib/auth', () => ({
  AUTH_TOKEN_CHANGED_EVENT: 'planora:auth-token-changed',
  ensureValidToken: jest.fn().mockResolvedValue(null),
  saveToken: jest.fn(),
  saveRefreshToken: jest.fn(),
  setRememberMe: jest.fn(),
}));

jest.mock('@/services/api-contract', () => ({
  authApi: { login: jest.fn() },
}));

describe('useLoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it.each(['EMAIL_NOT_VERIFIED', 'UNVERIFIED_EMAIL'])(
    'routes %s responses to email verification instead of leaving the user logged out',
    async (errorCode) => {
      (authApi.login as jest.Mock).mockRejectedValue({
        response: {
          status: 403,
          data: { errorCode, message: 'Email not verified' },
        },
      });
      const { result } = renderHook(() => useLoginForm());

      await waitFor(() => expect(result.current.isCheckingSession).toBe(false));
      act(() => {
        result.current.setEmail('Alice@Example.com');
        result.current.setPassword('ValidPassword123!');
      });

      await act(async () => {
        await result.current.handleLogin({ preventDefault: jest.fn() } as unknown as React.FormEvent<HTMLFormElement>);
      });

      expect(push).toHaveBeenCalledWith('/verify-email?email=alice%40example.com');
      expect(localStorage.getItem('pendingVerificationEmail')).toBe('alice@example.com');
      expect(result.current.error).toBe('');
    },
  );
});
