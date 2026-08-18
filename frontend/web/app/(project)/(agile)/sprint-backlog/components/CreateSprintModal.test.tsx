import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateSprintModal from './CreateSprintModal';
import { toast } from '@/components/ui';

jest.mock('@/components/ui', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('CreateSprintModal Date Validation', () => {
  const mockOnClose = jest.fn();
  const mockOnCreateSprint = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects start date in the past with proper error message and toast', async () => {
    render(
      <CreateSprintModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateSprint={mockOnCreateSprint}
        defaultName="Sprint 1"
      />
    );

    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startDateInput = dateInputs[0];
    const form = document.querySelector('form')!;

    fireEvent.change(startDateInput, { target: { value: '2020-01-01' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sprint start date cannot be before today. Please select today or a future date.');
      expect(screen.getByText('Sprint start date cannot be before today. Please select today or a future date.')).toBeInTheDocument();
      expect(mockOnCreateSprint).not.toHaveBeenCalled();
    });
  });

  it('rejects end date before start date with proper error message and toast', async () => {
    render(
      <CreateSprintModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateSprint={mockOnCreateSprint}
        defaultName="Sprint 1"
      />
    );

    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startDateInput = dateInputs[0];
    const endDateInput = dateInputs[1];
    const form = document.querySelector('form')!;

    fireEvent.change(startDateInput, { target: { value: '2099-05-10' } });
    fireEvent.change(endDateInput, { target: { value: '2099-05-05' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sprint end date cannot be before the sprint start date.');
      expect(screen.getByText('Sprint end date cannot be before the sprint start date.')).toBeInTheDocument();
      expect(mockOnCreateSprint).not.toHaveBeenCalled();
    });
  });

  it('allows valid future start date and on/after end date', async () => {
    render(
      <CreateSprintModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateSprint={mockOnCreateSprint}
        defaultName="Sprint 1"
      />
    );

    const dateInputs = document.querySelectorAll('input[type="date"]');
    const startDateInput = dateInputs[0];
    const endDateInput = dateInputs[1];
    const form = document.querySelector('form')!;

    fireEvent.change(startDateInput, { target: { value: '2099-05-10' } });
    fireEvent.change(endDateInput, { target: { value: '2099-05-24' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnCreateSprint).toHaveBeenCalledWith('Sprint 1', '2099-05-10', '2099-05-24', undefined);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
