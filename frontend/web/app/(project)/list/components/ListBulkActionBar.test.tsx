import { fireEvent, render, screen } from '@testing-library/react';
import ListBulkActionBar from './ListBulkActionBar';

describe('ListBulkActionBar', () => {
  it('does not render when nothing is selected', () => {
    render(
      <ListBulkActionBar
        selectedCount={0}
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        onClear={jest.fn()}
      />,
    );

    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
  });

  it('disables mutating actions for viewers', () => {
    render(
      <ListBulkActionBar
        selectedCount={2}
        canModifyTasks={false}
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        onClear={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Status/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeDisabled();
  });

  it('clears selected tasks', () => {
    const onClear = jest.fn();
    render(
      <ListBulkActionBar
        selectedCount={2}
        onStatusChange={jest.fn()}
        onDelete={jest.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Clear selection/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
