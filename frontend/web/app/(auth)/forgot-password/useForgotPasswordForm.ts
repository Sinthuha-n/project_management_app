'use client';

import { useState, useEffect, useRef } from 'react';
import { authApi } from '@/services/api-contract';
import { getApiRetryAfterSeconds, normalizeApiError } from '@/lib/api-error';

/*
 * Headless Business Logic Hook.
 * This manages the API communication contract between the Spring Boot backend 
 * and the Next.js frontend for the Forgot Password flow.
 */
export function useForgotPasswordForm() {
  // Step 1: Define the strict state required for this specific view.
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          setSubmitted(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cooldown]);

  // Step 2: Form Submission Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;

    // Reset state flags before firing the network request.
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // API CONTRACT: Send the email as a JSON payload to our Spring Boot endpoint.
      // We enforce lowercase here again just as a strict safety measure before it hits the DB.
      const response = await authApi.forgotPassword({
        email: email.toLowerCase(),
      });

      // On success:
      setSuccess(response.message || 'Verification code sent.');
      setSubmittedEmail(email);
      setSubmitted(true);
      setCooldown(60);
      setEmail(''); // Clear the input field for security/cleanliness.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Step 3: API Error Translation.
      // Spring Boot might send us a raw string (e.g., "Email not found") 
      // or a JSON object (e.g., { message: "Rate limit exceeded" }).
      // This block safely normalizes those responses into a string the UI can display.
      const retryAfter = getApiRetryAfterSeconds(err);
      const errorMessage = normalizeApiError(err, 'Failed to process request. Please try again.');
      setError(retryAfter ? `${errorMessage} Try again in ${retryAfter}s.` : errorMessage);
      if (retryAfter) setCooldown(retryAfter);
    } finally {
      // Step 4: Always turn off the loading spinner, even if the network fails.
      setIsLoading(false);
    }
  };

  // Step 5: Expose the state and the action function to the consuming component.
  return {
    email, setEmail,
    submittedEmail,
    isLoading,
    submitted, setSubmitted,
    error,
    success,
    cooldown,
    handleSubmit,
  };
}
