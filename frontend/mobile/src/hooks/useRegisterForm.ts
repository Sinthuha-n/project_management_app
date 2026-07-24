import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/axios';
import { buildRegisterRequest, register as registerBuilder, type RegisterRequest } from '@planora/contracts';
import { getValidToken } from '../lib/auth';
import { EMAIL_REGEX, validatePassword, getPasswordStrength } from '../lib/validation';
import { apiErrorMessage, apiRetryAfterSeconds } from '../utils/apiError';

export function useRegisterForm() {
  const router = useRouter();

  const [username,         setUsername]         = useState('');
  const [fullName,         setFullName]         = useState('');
  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [isLoading,        setIsLoading]        = useState(false);
  const [error,            setError]            = useState('');
  const [cooldown,         setCooldown]         = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(seconds - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    (async () => {
      const token = await getValidToken();
      if (token) router.replace('/(tabs)');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegister = async () => {
    if (isLoading || cooldown > 0) return;
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    const { valid, message } = validatePassword(password);
    if (!valid) {
      setError(message);
      setIsLoading(false);
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
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
      const request: RegisterRequest = buildRegisterRequest({
        username,
        fullName,
        email: email.toLowerCase(),
        password,
      });
      await registerBuilder(api, request);
      await AsyncStorage.setItem('pendingVerificationEmail', email.toLowerCase());
      router.push({ pathname: '/(auth)/verify-email', params: { email: email.toLowerCase() } });
    } catch (err: unknown) {
      const retryAfter = apiRetryAfterSeconds(err);
      const errorMessage = apiErrorMessage(err, 'Registration failed. Please try again.');
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
    error, setError,
    strength,
    handleRegister,
  };
}
