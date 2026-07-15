import * as WebBrowser from 'expo-web-browser';
import { startMobileGitHubOAuth } from './githubMobileService';

WebBrowser.maybeCompleteAuthSession();

export type GitHubOAuthResultCode =
  | 'success'
  | 'access_denied'
  | 'invalid_state'
  | 'expired_state'
  | 'account_already_linked'
  | 'exchange_failed'
  | 'configuration_error';

export type GitHubOAuthOutcome =
  | { type: 'success' }
  | { type: 'cancelled' }
  | { type: 'busy' }
  | { type: 'error'; code: GitHubOAuthResultCode | 'network_error' };

let flowActive = false;

export async function connectGitHub(options: {
  destination: 'PROFILE' | 'PROJECT';
  projectId?: string;
  loginHint?: string;
}): Promise<GitHubOAuthOutcome> {
  if (flowActive) return { type: 'busy' };
  flowActive = true;
  try {
    const { authorizationUrl } = await startMobileGitHubOAuth(
      options.destination,
      options.projectId,
      options.loginHint,
    );
    const browserResult = await WebBrowser.openAuthSessionAsync(
      authorizationUrl,
      'planora://github-callback',
    );
    if (browserResult.type !== 'success' || !browserResult.url) {
      return { type: 'cancelled' };
    }
    return parseGitHubOAuthReturnUrl(browserResult.url);
  } catch {
    return { type: 'error', code: 'network_error' };
  } finally {
    flowActive = false;
  }
}

export function parseGitHubOAuthReturnUrl(url: string): GitHubOAuthOutcome {
  try {
    const code = new URL(url).searchParams.get('result') as GitHubOAuthResultCode | null;
    if (code === 'success') return { type: 'success' };
    if (code && [
      'access_denied', 'invalid_state', 'expired_state', 'account_already_linked',
      'exchange_failed', 'configuration_error',
    ].includes(code)) {
      return { type: 'error', code };
    }
  } catch {
    // Invalid return URLs are treated as a failed exchange.
  }
  return { type: 'error', code: 'exchange_failed' };
}

export function githubOAuthErrorMessage(code: GitHubOAuthResultCode | 'network_error'): string {
  switch (code) {
    case 'access_denied': return 'GitHub authorization was cancelled.';
    case 'invalid_state': return 'This GitHub connection request is invalid. Please try again.';
    case 'expired_state': return 'This GitHub connection request expired. Please try again.';
    case 'account_already_linked': return 'This GitHub account is already linked to another Planora account.';
    case 'configuration_error': return 'GitHub OAuth is not configured correctly.';
    case 'network_error': return 'Unable to start GitHub authentication. Check your connection and try again.';
    default: return 'GitHub authentication failed. Please try again.';
  }
}
