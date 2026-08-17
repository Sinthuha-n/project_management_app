import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Page from './page';
import * as auth from '@/lib/auth';
import { toast } from '@/components/ui/Toast';

jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  ensureValidToken: jest.fn(),
  getValidToken: jest.fn(),
  getUserFromToken: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('@/components/ui/Toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('Homescreen Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders guest navigation (Sign In & Get Started) when user is not logged in', async () => {
    (auth.getValidToken as jest.Mock).mockReturnValue(null);
    (auth.ensureValidToken as jest.Mock).mockResolvedValue(null);
    (auth.getUserFromToken as jest.Mock).mockReturnValue(null);

    render(<Page />);

    expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument();
    // Multiple "Get Started" buttons (nav + hero)
    expect(screen.getAllByRole('link', { name: /Get Started/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Log Out/i })).not.toBeInTheDocument();
  });

  it('renders authenticated navigation (Dashboard & Log Out) when user is logged in', async () => {
    const mockUser: auth.User = { email: 'alex@example.com', username: 'AlexHero' };
    (auth.getValidToken as jest.Mock).mockReturnValue('mock-token');
    (auth.ensureValidToken as jest.Mock).mockResolvedValue('mock-token');
    (auth.getUserFromToken as jest.Mock).mockReturnValue(mockUser);

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText('AlexHero')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Out/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Go to Dashboard$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sign In/i })).not.toBeInTheDocument();
  });

  it('opens confirmation modal and logs out when user confirms logout', async () => {
    const mockUser: auth.User = { email: 'alex@example.com', username: 'AlexHero' };
    (auth.getValidToken as jest.Mock).mockReturnValue('mock-token');
    (auth.ensureValidToken as jest.Mock).mockResolvedValue('mock-token');
    (auth.getUserFromToken as jest.Mock).mockReturnValue(mockUser);
    (auth.logout as jest.Mock).mockResolvedValue(undefined);

    render(<Page />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Log Out/i })).toBeInTheDocument();
    });

    // Click logout on navbar
    fireEvent.click(screen.getByRole('button', { name: /Log Out/i }));

    // Confirmation modal should appear
    expect(screen.getByText('Log out of Planora?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to log out\?/i)).toBeInTheDocument();

    // Click confirm in modal
    const confirmButtons = screen.getAllByRole('button', { name: /Log Out/i });
    const modalConfirmButton = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(modalConfirmButton);

    await waitFor(() => {
      expect(auth.logout).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('You have been logged out successfully.');
    });
  });
});
