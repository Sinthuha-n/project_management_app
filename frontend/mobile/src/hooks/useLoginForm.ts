import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '../lib/axios';
import { buildLoginRequest, login as loginBuilder, type LoginRequest } from '@planora/contracts';
import { getValidToken, saveRefreshToken, saveToken, setRememberMe } from '../lib/auth';
import { EMAIL_REGEX } from '../lib/validation';
import { registerForPushNotifications } from '../lib/pushNotifications';

export function useLoginForm() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const redirectTo = Array.isArray(redirect) ? redirect[0] : redirect;

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [remember,     setRemember]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    (async () => {
      const token = await getValidToken();
      if (token) router.replace((redirectTo || '/(tabs)') as never);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectTo]);

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    try {
      const request: LoginRequest = buildLoginRequest({
        email: email.toLowerCase(),
        password,
      });
      const response = await loginBuilder(api, request);

      if (response.data.success) {
        await setRememberMe(remember);
        await saveToken(response.data.token);
        if (response.data.refreshToken) {
          await saveRefreshToken(response.data.refreshToken);
        }

        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          const pushToken = await registerForPushNotifications();
          if (pushToken) {
            try {
              await api.post('/api/user/me/push-token', {
                pushToken,
                platform: Platform.OS,
              });
            } catch {
              // Push registration is best effort; login should still succeed.
            }
          }
        }

        router.replace((redirectTo || '/(tabs)') as never);
      } else {
        setError(response.data.message || 'Login failed. Please try again.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: unknown } };
      const errorData = e.response?.data;
      let errorMessage = 'Login failed. Please try again.';

      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        errorMessage = (errorData as { message: string }).message;
      }

      if (e.response?.status === 403) {
        setError(errorMessage || 'Email is not verified. Please check your email.');
      } else if (e.response?.status === 401) {
        setError(errorMessage || 'Incorrect email or password.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    showPassword, setShowPassword,
    isLoading,
    error, setError,
    handleLogin,
  };
}
