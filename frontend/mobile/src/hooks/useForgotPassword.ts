import { useEffect, useRef, useState } from 'react';
import api from '../lib/axios';
import { buildForgotPasswordRequest, forgotPassword as forgotPasswordBuilder, type ForgotPasswordRequest } from '@planora/contracts';
import { EMAIL_REGEX } from '../lib/validation';
import { apiErrorMessage, apiRetryAfterSeconds } from '../utils/apiError';

export function useForgotPassword() {
  const [email,     setEmail]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCountdown = (seconds = 60) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(seconds);
    intervalRef.current = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  const handleSubmit = async () => {
    if (isLoading || countdown > 0) return;
    setError('');

    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const request: ForgotPasswordRequest = buildForgotPasswordRequest({ email: email.toLowerCase() });
      await forgotPasswordBuilder(api, request);
      setSubmitted(true);
      startCountdown();
    } catch (err: unknown) {
      const retryAfter = apiRetryAfterSeconds(err);
      const message = apiErrorMessage(err, 'Failed to send reset code. Please try again.');
      setError(retryAfter ? `${message} Try again in ${retryAfter}s.` : message);
      if (retryAfter) {
        startCountdown(retryAfter);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setEmail('');
    setCountdown(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return {
    email, setEmail,
    isLoading,
    submitted,
    error, setError,
    countdown,
    handleSubmit,
    handleReset,
  };
}
