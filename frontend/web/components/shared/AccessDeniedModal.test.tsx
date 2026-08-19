import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AccessDeniedModal from './AccessDeniedModal';
import { ACCESS_DENIED_MESSAGE, ACCESS_DENIED_TITLE } from '@/lib/project-permissions';

describe('AccessDeniedModal', () => {
  it('does not render when open is false', () => {
    render(<AccessDeniedModal open={false} onClose={jest.fn()} />);
    expect(screen.queryByText(ACCESS_DENIED_TITLE)).not.toBeInTheDocument();
  });

  it('renders default title and message when open is true', () => {
    render(<AccessDeniedModal open={true} onClose={jest.fn()} />);
    expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
    expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Understood' })).toBeInTheDocument();
  });

  it('calls onClose when button or close X is clicked', () => {
    const handleClose = jest.fn();
    render(<AccessDeniedModal open={true} onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Understood' }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = jest.fn();
    render(<AccessDeniedModal open={true} onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
