import api from '@/lib/axios';
import {
  login as loginBuilder,
  register as registerBuilder,
  forgotPassword as forgotPasswordBuilder,
  resetPassword as resetPasswordBuilder,
  updateProfile as updateProfileBuilder,
} from '@planora/contracts';
import type { LoginRequest, RegisterRequest, ResetPasswordRequest, UpdateProfileRequest } from '@planora/contracts';

export interface AuthUserSummary {
  userId?: number;
  email?: string;
  username?: string;
  profilePicUrl?: string | null;
  fullName?: string;
}

export interface UserProfileDto {
  userId: number;
  username: string;
  fullName: string | null;
  email: string;
  verified: boolean;
  profilePicUrl: string | null;
  lastActive: string | null;
  firstName: string | null;
  lastName: string | null;
  contactNumber: string | null;
  countryCode: string | null;
  jobTitle: string | null;
  company: string | null;
  position: string | null;
  bio: string | null;
  githubUsername: string | null;
  githubEmail: string | null;
}

export interface PhotoUploadResponse {
  success: boolean;
  message: string;
  fileUrl: string | null;
  errorCode: string | null;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<{ accessToken: string; refreshToken: string }> => {
    const { data } = await loginBuilder(api, credentials);
    return data;
  },
  register: async (payload: RegisterRequest): Promise<void> => {
    await registerBuilder(api, payload);
  },
  forgotPassword: async (payload: { email: string }): Promise<{ message?: string }> => {
    const { data } = await forgotPasswordBuilder(api, payload);
    return data;
  },
  resetPassword: async (payload: ResetPasswordRequest): Promise<void> => {
    await resetPasswordBuilder(api, payload);
  },
  verifyEmail: async (payload: { email: string; otp: string }): Promise<void> => {
    await api.post('/api/auth/reg/verify', payload);
  },
  resendOtp: async (payload: { email: string }): Promise<{ message?: string }> => {
    const { data } = await api.post('/api/auth/resend', payload);
    return data;
  },
  getCurrentUser: async (): Promise<{ userId?: number; username: string; email?: string; fullName?: string; profilePicUrl?: string | null }> => {
    const { data } = await api.get('/api/user/me');
    return data;
  },
  getProfile: async (): Promise<UserProfileDto> => {
    const { data } = await api.get('/api/user/profile');
    return data;
  },
  updateProfile: async (payload: Partial<UserProfileDto>): Promise<UserProfileDto> => {
    const cleanedPayload = Object.fromEntries(
      Object.entries(payload).map(([key, val]) => [key, val === null ? undefined : val])
    ) as UpdateProfileRequest;
    const { data } = await updateProfileBuilder(api, cleanedPayload);
    return data;
  },
  uploadProfilePhoto: async (formData: FormData): Promise<PhotoUploadResponse> => {
    const { data } = await api.post('/api/user/profile/photo', formData);
    return data;
  },
  getAllUsers: async (): Promise<AuthUserSummary[]> => {
    const { data } = await api.get('/api/auth/users');
    return data;
  },
};
