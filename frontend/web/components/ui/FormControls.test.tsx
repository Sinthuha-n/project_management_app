import { render, screen } from '@testing-library/react';
import { FormField, Input, Select, Textarea } from './index';

describe('form controls', () => {
  it('connects labels, help text, and errors accessibly', () => {
    const { rerender } = render(
      <Input
        label="Task title"
        helpText="Use a short action phrase."
        required
      />,
    );

    const input = screen.getByLabelText(/Task title/);
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Use a short action phrase.');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');

    rerender(<Input label="Task title" error="A title is required." />);
    expect(screen.getByLabelText('Task title')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Task title')).toHaveAccessibleDescription('A title is required.');
    expect(screen.getByRole('alert')).toHaveTextContent('A title is required.');
  });

  it('gives textarea and select the neutral focus contract', () => {
    render(
      <>
        <Textarea label="Description" />
        <Select
          label="Priority"
          options={[{ value: 'HIGH', label: 'High' }]}
        />
      </>,
    );

    expect(screen.getByLabelText('Description')).toHaveClass(
      'focus:border-[var(--cu-focus-border)]',
      'focus:ring-[var(--cu-focus-ring)]',
    );
    expect(screen.getByLabelText('Priority')).toHaveClass(
      'focus:border-[var(--cu-focus-border)]',
      'focus:ring-[var(--cu-focus-ring)]',
    );
  });

  it('supports specialized native controls through FormField', () => {
    render(
      <FormField
        label="Due date"
        helpText="Uses your project timezone."
        error="Choose a future date."
      >
        <input type="date" />
      </FormField>,
    );

    const input = screen.getByLabelText('Due date');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Uses your project timezone. Choose a future date.',
    );
  });
});
