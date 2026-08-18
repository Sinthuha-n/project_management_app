import { fireEvent, render, screen } from '@testing-library/react';
import DmsPagination from './DmsPagination';

describe('DmsPagination', () => {
    it('does not render when totalItems is 0', () => {
        const { container } = render(
            <DmsPagination
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
            <DmsPagination
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
        expect(screen.getByText(/of/i)).toBeInTheDocument();
        expect(screen.getByText(/documents/i)).toBeInTheDocument();
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
            <DmsPagination
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
            <DmsPagination
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

        fireEvent.change(screen.getByLabelText(/Rows per page/i), {
            target: { value: '25' },
        });
        expect(onPageSizeChange).toHaveBeenCalledWith(25);
    });

    it('disables next and last buttons on the last page', () => {
        render(
            <DmsPagination
                currentPage={5}
                totalPages={5}
                pageSize={10}
                totalItems={45}
                startIndex={40}
                endIndex={45}
                onPageChange={jest.fn()}
                onPageSizeChange={jest.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /Next page/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Last page/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Previous page/i })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /First page/i })).not.toBeDisabled();
    });
});
