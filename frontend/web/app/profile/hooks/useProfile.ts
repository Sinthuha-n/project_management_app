'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { ensureValidToken, getUserFromToken } from '@/lib/auth';
import { updateProfile } from '@planora/contracts';
import { EditableProfileFields, hasProfileChanges, normalizeEditableProfile } from '../lib/profile-utils';

type UserResponse = {
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
};

type PhotoUploadResponse = {
    success: boolean;
    message: string;
    fileUrl: string | null;
    errorCode: string | null;
};

function getApiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof AxiosError) {
        const data = error.response?.data;
        if (typeof data === 'string' && data.trim()) return data;
        if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message;
            if (typeof message === 'string' && message.trim()) return message;
        }
    }
    return fallback;
}

export function useProfile() {
    const router = useRouter();
    const [reloadToken, setReloadToken] = useState(0);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [countryCode, setCountryCode] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [company, setCompany] = useState('');
    const [position, setPosition] = useState('');
    const [bio, setBio] = useState('');
    const [profilePicUrl, setProfilePicUrl] = useState('');
    const [imageKey, setImageKey] = useState(Date.now());
    const [lastActive, setLastActive] = useState<string | null>(null);
    const [loadedProfile, setLoadedProfile] = useState<EditableProfileFields | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const resolvedProfilePicUrl = useMemo(() => profilePicUrl || '', [profilePicUrl]);
    const currentProfile = useMemo<EditableProfileFields>(() => ({
        fullName,
        firstName,
        lastName,
        contactNumber,
        countryCode,
        jobTitle,
        company,
        position,
        bio,
    }), [bio, company, contactNumber, countryCode, firstName, fullName, jobTitle, lastName, position]);
    const hasUnsavedChanges = useMemo(
        () => hasProfileChanges(currentProfile, loadedProfile),
        [currentProfile, loadedProfile],
    );
    const canSaveProfile = hasUnsavedChanges && !isSavingName;

    useEffect(() => {
        let isMounted = true;

        const loadProfile = async () => {
            const token = await ensureValidToken({ allowCookieRefresh: true });
            if (!token || !isMounted) {
                if (isMounted) router.push('/login');
                return;
            }

            const tokenUser = getUserFromToken();
            if (!tokenUser) {
                router.push('/login');
                return;
            }

            setIsLoading(true);
            setErrorMessage('');
            setSuccessMessage('');
            setUsername(tokenUser.username || '');
            setEmail(tokenUser.email || '');

            try {
                const response = await api.get<UserResponse>('/api/user/profile');
                if (!isMounted) return;
                const p = response.data;
                setUsername(p.username || tokenUser.username || '');
                setEmail(p.email || tokenUser.email || '');
                setFullName(p.fullName || '');
                setFirstName(p.firstName || '');
                setLastName(p.lastName || '');
                setContactNumber(p.contactNumber || '');
                setCountryCode(p.countryCode || '');
                setJobTitle(p.jobTitle || '');
                setCompany(p.company || '');
                setPosition(p.position || '');
                setBio(p.bio || '');
                setProfilePicUrl(p.profilePicUrl || '');
                setLastActive(p.lastActive || null);
                setLoadedProfile({
                    fullName: p.fullName || '',
                    firstName: p.firstName || '',
                    lastName: p.lastName || '',
                    contactNumber: p.contactNumber || '',
                    countryCode: p.countryCode || '',
                    jobTitle: p.jobTitle || '',
                    company: p.company || '',
                    position: p.position || '',
                    bio: p.bio || '',
                });
            } catch (error: unknown) {
                if (isMounted) setErrorMessage(getApiErrorMessage(error, 'Failed to load profile details.'));
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        void loadProfile();

        return () => {
            isMounted = false;
        };
    }, [router, reloadToken]);

    const reloadProfile = () => {
        setReloadToken((value) => value + 1);
    };

    const onSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!hasUnsavedChanges) return;
        setErrorMessage('');
        setSuccessMessage('');
        try {
            setIsSavingName(true);
            const normalizedProfile = normalizeEditableProfile(currentProfile);
            const response = await updateProfile(api, {
                fullName: normalizedProfile.fullName || undefined,
                firstName: normalizedProfile.firstName || undefined,
                lastName: normalizedProfile.lastName || undefined,
                contactNumber: normalizedProfile.contactNumber || undefined,
                countryCode: normalizedProfile.countryCode || undefined,
                jobTitle: normalizedProfile.jobTitle || undefined,
                company: normalizedProfile.company || undefined,
                position: normalizedProfile.position || undefined,
                bio: normalizedProfile.bio || undefined,
            });
            const p = response.data;
            setFullName(p.fullName || '');
            setFirstName(p.firstName || '');
            setLastName(p.lastName || '');
            setContactNumber(p.contactNumber || '');
            setCountryCode(p.countryCode || '');
            setJobTitle(p.jobTitle || '');
            setCompany(p.company || '');
            setPosition(p.position || '');
            setBio(p.bio || '');
            setLoadedProfile({
                fullName: p.fullName || '',
                firstName: p.firstName || '',
                lastName: p.lastName || '',
                contactNumber: p.contactNumber || '',
                countryCode: p.countryCode || '',
                jobTitle: p.jobTitle || '',
                company: p.company || '',
                position: p.position || '',
                bio: p.bio || '',
            });
            setSuccessMessage('Profile updated successfully.');
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, 'Failed to update profile.'));
        } finally {
            setIsSavingName(false);
        }
    };

    const onUploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setErrorMessage('');
        setSuccessMessage('');
        const formData = new FormData();
        formData.append('file', file);
        try {
            setIsUploadingPhoto(true);
            const response = await api.post<PhotoUploadResponse>('/api/user/profile/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (!response.data.success) {
                setErrorMessage(response.data.message || 'Failed to upload profile picture.');
                return;
            }
            setProfilePicUrl(response.data.fileUrl || '');
            setImageKey(Date.now());
            setSuccessMessage('Profile picture updated successfully.');
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, 'Failed to upload profile picture.'));
        } finally {
            setIsUploadingPhoto(false);
            event.target.value = '';
        }
    };

    return {
        username,
        email,
        fullName, setFullName,
        firstName, setFirstName,
        lastName, setLastName,
        contactNumber, setContactNumber,
        countryCode, setCountryCode,
        jobTitle, setJobTitle,
        company, setCompany,
        position, setPosition,
        bio, setBio,
        resolvedProfilePicUrl,
        imageKey,
        lastActive,
        isLoading,
        isSavingName,
        isUploadingPhoto,
        hasUnsavedChanges,
        canSaveProfile,
        errorMessage,
        successMessage,
        reloadProfile,
        onSaveProfile,
        onUploadPhoto,
    };
}
