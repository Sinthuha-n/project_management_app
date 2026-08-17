import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogoutConfirmModal } from './LogoutConfirmModal';

describe('LogoutConfirmModal', () => {
  it('renders title, description, cache notice, and buttons when open', () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <LogoutConfirmModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Log out of Planora?')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to log out\?/i)).toBeInTheDocument();
    expect(screen.getByText(/All cached session data and offline storage on this browser will be securely cleared/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Out/i })).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when Cancel is clicked', () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <LogoutConfirmModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm when Log Out is clicked', async () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <LogoutConfirmModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Log Out/i }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading spinner and disables buttons when isLoggingOut is true', () => {
    const onOpenChange = jest.fn();
    const onConfirm = jest.fn();

    render(
      <LogoutConfirmModal
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isLoggingOut={true}
      />
    );

    expect(screen.getByText(/Logging out…/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Logging out…/i })).toBeDisabled();
  });
});
