'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureValidToken } from '@/lib/auth';
import { validatePassword, PASSWORD_REQUIREMENTS } from '@/lib/passwordValidation';
import { authApi } from '@/services/api-contract';
import { getApiRetryAfterSeconds, normalizeApiError } from '@/lib/api-error';

// Exported so the view component can read human-friendly labels and Tailwind colour classes
// without duplicating the mapping or adding a prop-drilling chain.
export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
export const STRENGTH_COLOURS = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'] as const;

// Only returns 4 (Strong) when every requirement passes — including length —
// so the bar never shows "Strong" for a short complex password like "Ab1!".
function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  const met = PASSWORD_REQUIREMENTS.filter(req => req.test(pw)).length;
  if (met === PASSWORD_REQUIREMENTS.length) return 4;
  return Math.min(3, met) as 0 | 1 | 2 | 3;
}

export function useRegisterForm() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => setCooldown((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => window.clearInterval(interval);
  }, [cooldown]);

  // replace() instead of push() so the browser's Back button can't navigate back to the register page after login
  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      if (await ensureValidToken()) {
        if (isMounted) router.replace('/dashboard');
      }
    };

    void redirectIfAuthenticated();
    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useMemo avoids re-running the regex checks on every keystroke that doesn't touch the password field
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      setIsLoading(false);
      return;
    }

    const { valid, message } = validatePassword(password);
    if (!valid) {
      setError(message);
      setIsLoading(false);
      return;
    }

    // This regex is a basic check for the presence of "@" and "." in the right order, 
    // but it doesn't guarantee the email is deliverable or that the user has access to it.
    // This regex checks for text + @ + text + . + text
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3–20 characters: letters, numbers, underscore only.');
      setIsLoading(false);
      return;
    }

    try {
      await authApi.register({
        username, fullName, email: email.toLowerCase(), password,
      });
      // Stored in localStorage so PendingVerificationBanner can show the email even after a page refresh.
      localStorage.setItem('pendingVerificationEmail', email.toLowerCase());
      router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const retryAfter = getApiRetryAfterSeconds(err);
      const errorMessage = normalizeApiError(err, 'Registration failed. Please try again.');
      setError(retryAfter ? `${errorMessage} Try again in ${retryAfter}s.` : errorMessage);
      if (retryAfter) setCooldown(retryAfter);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    username, setUsername,
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    isLoading,
    cooldown,
    error,
    strength,
    handleRegister,
  };
}
