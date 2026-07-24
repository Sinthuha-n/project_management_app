import { fireEvent, render, screen } from '@testing-library/react';
import Button from '@/components/shared/Button';
import { Button as CanonicalButton } from './Button';

describe('shared button contract', () => {
  it('keeps the legacy import aligned with the canonical button behavior', () => {
    const onClick = jest.fn();
    render(<Button leftIcon={<span>+</span>} onClick={onClick}>Create task</Button>);

    const control = screen.getByRole('button', { name: 'Create task' });
    fireEvent.click(control);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(control).toHaveClass('bg-cu-primary');
  });

  it('disables the control and exposes a loading indicator while busy', () => {
    render(<CanonicalButton loading>Save changes</CanonicalButton>);

    const control = screen.getByRole('button', { name: 'Save changes' });
    expect(control).toBeDisabled();
    expect(control.querySelector('svg')).toHaveClass('animate-spin');
  });
});
