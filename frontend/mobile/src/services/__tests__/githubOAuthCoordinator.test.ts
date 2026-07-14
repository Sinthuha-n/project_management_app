import * as WebBrowser from 'expo-web-browser';
import { startMobileGitHubOAuth } from '../githubMobileService';
import { connectGitHub, parseGitHubOAuthReturnUrl } from '../githubOAuthCoordinator';

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../githubMobileService', () => ({
  startMobileGitHubOAuth: jest.fn(),
}));

const mockStart = startMobileGitHubOAuth as jest.MockedFunction<typeof startMobileGitHubOAuth>;
const mockOpen = WebBrowser.openAuthSessionAsync as jest.MockedFunction<typeof WebBrowser.openAuthSessionAsync>;

describe('GitHub OAuth coordinator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts the backend flow and accepts a successful branded callback', async () => {
    mockStart.mockResolvedValue({ authorizationUrl: 'https://github.com/login/oauth/authorize?state=x', expiresInSeconds: 600 });
    mockOpen.mockResolvedValue({ type: 'success', url: 'planora://github-callback?result=success&destination=profile' });

    await expect(connectGitHub({ destination: 'PROFILE' })).resolves.toEqual({ type: 'success' });
    expect(mockStart).toHaveBeenCalledWith('PROFILE', undefined);
    expect(mockOpen).toHaveBeenCalledWith(expect.stringContaining('github.com'), 'planora://github-callback');
  });

  it('maps browser dismissal to cancellation', async () => {
    mockStart.mockResolvedValue({ authorizationUrl: 'https://github.com/login/oauth/authorize', expiresInSeconds: 600 });
    mockOpen.mockResolvedValue({ type: 'cancel' } as Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>);
    await expect(connectGitHub({ destination: 'PROJECT', projectId: '9' })).resolves.toEqual({ type: 'cancelled' });
  });

  it('maps stable backend result codes without exposing provider details', () => {
    expect(parseGitHubOAuthReturnUrl('planora://github-callback?result=expired_state'))
      .toEqual({ type: 'error', code: 'expired_state' });
    expect(parseGitHubOAuthReturnUrl('not a url'))
      .toEqual({ type: 'error', code: 'exchange_failed' });
  });
});
