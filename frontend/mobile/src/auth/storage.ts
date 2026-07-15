import {
  getValidToken,
  saveToken,
  saveRefreshToken,
  clearTokens,
  getRefreshToken,
  ensureValidToken,
  refreshAccessToken,
  setRememberMe,
  getRememberMe,
  getUserIdFromToken
} from '../lib/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export {
  getValidToken,
  saveToken,
  saveRefreshToken,
  clearTokens,
  getRefreshToken,
  ensureValidToken,
  refreshAccessToken,
  setRememberMe,
  getRememberMe
};

// Backward compatibility helpers used by other screens/components
export const getToken = getValidToken;
export async function clearRefreshToken(): Promise<void> {
  // Safe no-op or partial clear; clearTokens clears all which is safer
  const rt = await getRefreshToken();
  if (rt) {
    if (Platform.OS === 'web') {
      localStorage.removeItem('planora_refresh_token');
    } else {
      await SecureStore.deleteItemAsync('planora_refresh_token');
    }
  }
}
export const getCurrentUserId = getUserIdFromToken;
