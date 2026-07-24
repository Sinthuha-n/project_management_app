'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AUTH_TOKEN_CHANGED_EVENT, ensureValidToken, saveToken, saveRefreshToken, setRememberMe } from '@/lib/auth';
import { buildVerifyEmailPath, isEmailVerificationRequired, rememberPendingVerificationEmail } from '@/lib/email-verification';
import { authApi } from '@/services/api-contract';
import { getApiRetryAfterSeconds, normalizeApiError } from '@/lib/api-error';

const PENDING_INVITE_TOKEN_KEY = 'pendingInviteToken';

interface LoginResponse {
  success?: boolean;
  token?: string;
  accessToken?: string;
  message?: string;
}

/*
 * Headless Business Logic Hook for Login.
 * Manages the API contract between the Next.js frontend and the Spring Boot backend.
 */
export function useLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Form State ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Network State ──
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => setCooldown((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => window.clearInterval(interval);
  }, [cooldown]);

  /*
   * UX Optimization: Silent Auth Bypass.
   * On component mount, check if we already have a valid JWT. 
   * If so, instantly kick the user to the dashboard so they don't have to look at a login screen.
   */
  useEffect(() => {
    let isMounted = true;

    const getAuthenticatedRedirect = () => {
      const pendingInviteToken = localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
      return searchParams.get('redirect')
        || (pendingInviteToken ? `/accept-invite?token=${encodeURIComponent(pendingInviteToken)}` : '/dashboard');
    };

    const redirectIfAuthenticated = async () => {
      if (await ensureValidToken({ allowCookieRefresh: true })) {
        // Use replace() instead of push() so the user can't hit the "Back" button
        // and end up stuck on the login page again.
        if (isMounted) router.replace(getAuthenticatedRedirect());
      } else if (isMounted) {
        setIsCheckingSession(false);
      }
    };

    const handleAuthTokenChanged = () => {
      void redirectIfAuthenticated();
    };

    void redirectIfAuthenticated();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
    return () => {
      isMounted = false;
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core Login Execution
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;
    setIsLoading(true);
    setError('');

    // This regex is a basic check for the presence of "@" and "." in the right order, 
    // but it doesn't guarantee the email is deliverable or that the user has access to it.
    // This regex checks for text + @ + text + . + text
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }
    

    try {
      // API CONTRACT: Send credentials to Spring Boot.
      const response = await authApi.login({
        email: email.toLowerCase(),
        password,
      });

      const loginResponse = response as LoginResponse;
      const accessToken = loginResponse.token || loginResponse.accessToken || '';

      if (accessToken || loginResponse.success) {
        if (!accessToken) {
          setError(loginResponse.message || 'Login succeeded, but no access token was returned.');
          return;
        }

        // Step 1: Tell our local auth utility how long to keep these tokens alive based on user preference.
        setRememberMe(remember);

        // Step 2: Persist the Access JWT.
        saveToken(accessToken);

        // Step 3: Persist the Refresh Token presence (HttpOnly cookie is set by backend).
        saveRefreshToken('true', { broadcast: true });

        // Step 4: Route to the authenticated app (or back to the deep link they came from).
        const pendingInviteToken = localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
        const redirectTo = searchParams.get('redirect')
          || (pendingInviteToken ? `/accept-invite?token=${encodeURIComponent(pendingInviteToken)}` : '/dashboard');
        router.push(redirectTo);
      } else {
        setError(loginResponse.message || 'Login failed. Please try again.');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // ── API Error Translation ──
      // This block bridges the gap between raw HTTP protocol errors and user-friendly UI text.
      const retryAfter = getApiRetryAfterSeconds(err);
      const errorMessage = normalizeApiError(err, 'Login failed. Please try again.');

      if (isEmailVerificationRequired(err)) {
        const normalizedEmail = email.toLowerCase();
        rememberPendingVerificationEmail(normalizedEmail);
        router.push(buildVerifyEmailPath(normalizedEmail));
        return;
      }

      // Map strict HTTP Status Codes to contextual help.
      if (err.response?.status === 403) {
        // Other forbidden responses remain visible instead of being mistaken for auth expiry.
        setError(errorMessage || 'Email is not verified. Please check your email.');
      } else if (err.response?.status === 401) {
        // 401 Unauthorized is standard for bad credentials.
        setError(errorMessage || 'Incorrect email or password.');
      } else {
        // 500s or unknown errors.
        setError(retryAfter ? `${errorMessage} Try again in ${retryAfter}s.` : errorMessage);
      }
      if (retryAfter) setCooldown(retryAfter);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose the internal state and actions to the View Component.
  return {
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    showPassword, setShowPassword,
    isLoading,
    isCheckingSession,
    error,
    cooldown,
    handleLogin,
  };
}
