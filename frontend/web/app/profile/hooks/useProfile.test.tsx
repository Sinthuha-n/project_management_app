import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChangeEvent, FormEvent } from 'react';
import api from '@/lib/axios';
import { ensureValidToken, getUserFromToken } from '@/lib/auth';
import { updateProfile } from '@planora/contracts';
import { useProfile } from './useProfile';

const mockRouter = { push: jest.fn() };

jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
}));

jest.mock('@/lib/axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

jest.mock('@/lib/auth', () => ({
    ensureValidToken: jest.fn(),
    getUserFromToken: jest.fn(),
}));

jest.mock('@planora/contracts', () => ({
    updateProfile: jest.fn(),
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedEnsureValidToken = ensureValidToken as jest.MockedFunction<typeof ensureValidToken>;
const mockedGetUserFromToken = getUserFromToken as jest.MockedFunction<typeof getUserFromToken>;
const mockedUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;

const profileResponse = {
    userId: 7,
    username: 'sutha',
    fullName: 'Suthan Kanthan',
    email: 'sutha@example.com',
    verified: true,
    profilePicUrl: null,
    lastActive: '2026-07-07T06:30:00Z',
    firstName: 'Suthan',
    lastName: 'Kanthan',
    contactNumber: '5550000',
    countryCode: '+1',
    jobTitle: 'Product Engineer',
    company: 'Planora',
    position: 'Engineering',
    bio: 'Building useful tools.',
};

describe('useProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRouter.push.mockReset();
        mockedEnsureValidToken.mockResolvedValue('token');
        mockedGetUserFromToken.mockReturnValue({
            username: 'token-user',
            email: 'token@example.com',
        } as ReturnType<typeof getUserFromToken>);
        mockedApi.get.mockResolvedValue({ data: profileResponse });
    });

    it('loads profile data into editable state', async () => {
        const { result } = renderHook(() => useProfile());

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockedApi.get).toHaveBeenCalledWith('/api/user/profile');
        expect(result.current.fullName).toBe('Suthan Kanthan');
        expect(result.current.contactNumber).toBe('5550000');
        expect(result.current.countryCode).toBe('+1');
        expect(result.current.hasUnsavedChanges).toBe(false);
        expect(result.current.canSaveProfile).toBe(false);
    });

    it('saves trimmed editable profile values and clears unsaved state', async () => {
        mockedUpdateProfile.mockResolvedValueOnce({
            data: { ...profileResponse, fullName: 'Updated Name', contactNumber: '7778888' },
        });

        const { result } = renderHook(() => useProfile());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.setFullName('  Updated Name  ');
            result.current.setContactNumber(' 7778888 ');
        });

        expect(result.current.hasUnsavedChanges).toBe(true);

        await act(async () => {
            await result.current.onSaveProfile({ preventDefault: jest.fn() } as unknown as FormEvent<HTMLFormElement>);
        });

        expect(mockedUpdateProfile).toHaveBeenCalledWith(api, expect.objectContaining({
            fullName: 'Updated Name',
            contactNumber: '7778888',
            countryCode: '+1',
        }));
        expect(result.current.fullName).toBe('Updated Name');
        expect(result.current.hasUnsavedChanges).toBe(false);
    });

    it('uploads a profile photo and updates the avatar URL', async () => {
        mockedApi.post.mockResolvedValueOnce({
            data: {
                success: true,
                message: 'ok',
                fileUrl: '/uploads/new-avatar.png',
                errorCode: null,
            },
        });

        const { result } = renderHook(() => useProfile());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
        const event = {
            target: {
                files: [file],
                value: 'avatar.png',
            },
        } as unknown as ChangeEvent<HTMLInputElement>;

        await act(async () => {
            await result.current.onUploadPhoto(event);
        });

        expect(mockedApi.post).toHaveBeenCalledWith('/api/user/profile/photo', expect.any(FormData), {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        expect(result.current.resolvedProfilePicUrl).toBe('/uploads/new-avatar.png');
        expect((event.target as HTMLInputElement).value).toBe('');
    });
});
