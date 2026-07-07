import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import ProfilePage from './page';
import { useProfile } from './hooks/useProfile';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => {
    return function MockLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
        return <a href={href} className={className}>{children}</a>;
    };
});

jest.mock('react-international-phone', () => ({
    PhoneInput: ({ onChange, value }: { onChange: (phone: string, meta: { country: { dialCode: string } }) => void; value: string }) => (
        <div data-testid="phone-input">
            <span data-testid="phone-value">{value}</span>
            <button type="button" onClick={() => onChange('+94771234567', { country: { dialCode: '94' } })}>
                Choose Sri Lanka
            </button>
        </div>
    ),
}));

jest.mock('./hooks/useProfile', () => ({
    useProfile: jest.fn(),
}));

jest.mock('./hooks/useChangePassword', () => ({
    useChangePassword: () => ({
        pwStep: 'idle',
        setPwStep: jest.fn(),
        isSendingOtp: false,
        isResettingPw: false,
        otp: '',
        setOtp: jest.fn(),
        newPassword: '',
        setNewPassword: jest.fn(),
        confirmPassword: '',
        setConfirmPassword: jest.fn(),
        error: '',
        success: '',
        handleSendOtp: jest.fn(),
        handleResetPassword: jest.fn(),
    }),
}));

const mockedUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;

function makeProfile(overrides: Partial<ReturnType<typeof useProfile>> = {}): ReturnType<typeof useProfile> {
    return {
        username: 'sutha',
        email: 'sutha@example.com',
        fullName: 'Suthan Kanthan',
        setFullName: jest.fn(),
        firstName: 'Suthan',
        setFirstName: jest.fn(),
        lastName: 'Kanthan',
        setLastName: jest.fn(),
        contactNumber: '5550000',
        setContactNumber: jest.fn(),
        countryCode: '+1',
        setCountryCode: jest.fn(),
        jobTitle: 'Product Engineer',
        setJobTitle: jest.fn(),
        company: 'Planora',
        setCompany: jest.fn(),
        position: 'Engineering',
        setPosition: jest.fn(),
        bio: 'Building useful tools.',
        setBio: jest.fn(),
        resolvedProfilePicUrl: '',
        imageKey: 1,
        lastActive: '2026-07-07T06:30:00Z',
        isLoading: false,
        isSavingName: false,
        isUploadingPhoto: false,
        hasUnsavedChanges: false,
        canSaveProfile: false,
        errorMessage: '',
        successMessage: '',
        reloadProfile: jest.fn(),
        onSaveProfile: jest.fn(),
        onUploadPhoto: jest.fn(),
        ...overrides,
    };
}

describe('ProfilePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders loaded profile data and disables save when there are no changes', () => {
        mockedUseProfile.mockReturnValue(makeProfile());

        render(<ProfilePage />);

        expect(screen.getByRole('heading', { name: 'Profile Settings' })).toBeInTheDocument();
        expect(screen.getByDisplayValue('Suthan Kanthan')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
        expect(screen.getByText('Profile is up to date')).toBeInTheDocument();
    });

    it('splits selected phone country code from the contact number', () => {
        const setCountryCode = jest.fn();
        const setContactNumber = jest.fn();
        mockedUseProfile.mockReturnValue(makeProfile({ setCountryCode, setContactNumber }));

        render(<ProfilePage />);

        fireEvent.click(screen.getByRole('button', { name: 'Choose Sri Lanka' }));

        expect(setCountryCode).toHaveBeenCalledWith('+94');
        expect(setContactNumber).toHaveBeenCalledWith('771234567');
    });
});
