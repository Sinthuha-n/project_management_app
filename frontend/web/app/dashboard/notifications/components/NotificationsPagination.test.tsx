import { fireEvent, render, screen } from '@testing-library/react';
import NotificationsPagination from './NotificationsPagination';

describe('NotificationsPagination', () => {
  it('does not render when totalItems is 0', () => {
    const { container } = render(
      <NotificationsPagination
        currentPage={1}
        totalPages={1}
        pageSize={10}
        totalItems={0}
        startIndex={0}
        endIndex={0}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders pagination details and page buttons correctly', () => {
    const onPageChange = jest.fn();
    const onPageSizeChange = jest.fn();

    render(
      <NotificationsPagination
        currentPage={1}
        totalPages={3}
        pageSize={10}
        totalItems={25}
        startIndex={0}
        endIndex={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText(/Rows per page:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Page 1$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Page 2$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Page 3$/i })).toBeInTheDocument();

    // Previous and First buttons should be disabled on page 1
    expect(screen.getByRole('button', { name: /Previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /First page/i })).toBeDisabled();

    // Next and Last buttons should be enabled
    expect(screen.getByRole('button', { name: /Next page/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Last page/i })).not.toBeDisabled();
  });

  it('handles navigation clicks correctly', () => {
    const onPageChange = jest.fn();

    render(
      <NotificationsPagination
        currentPage={2}
        totalPages={5}
        pageSize={10}
        totalItems={45}
        startIndex={10}
        endIndex={20}
        onPageChange={onPageChange}
        onPageSizeChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Page 3$/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: /Next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('button', { name: /Previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /First page/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: /Last page/i }));
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('handles page size changes', () => {
    const onPageSizeChange = jest.fn();

    render(
      <NotificationsPagination
        currentPage={1}
        totalPages={4}
        pageSize={10}
        totalItems={35}
        startIndex={0}
        endIndex={10}
        onPageChange={jest.fn()}
        onPageSizeChange={onPageSizeChange}
      />
    );

    const select = screen.getByRole('combobox', { name: /Rows per page/i });
    fireEvent.change(select, { target: { value: '20' } });

    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });

  it('disables all buttons when disabled prop is true', () => {
    render(
      <NotificationsPagination
        currentPage={2}
        totalPages={3}
        pageSize={10}
        totalItems={25}
        startIndex={10}
        endIndex={20}
        onPageChange={jest.fn()}
        onPageSizeChange={jest.fn()}
        disabled={true}
      />
    );

    expect(screen.getByRole('button', { name: /First page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Page 1$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Page 2$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Last page/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /Rows per page/i })).toBeDisabled();
  });
});
