import { fireEvent, render, screen } from '@testing-library/react';
import DmsDocumentToolbar from './DmsDocumentToolbar';
import type { DocumentFilters } from './types';

const filters: DocumentFilters = {
  search: '',
  type: 'all',
  folderId: 'all',
  uploader: '',
  favoriteOnly: false,
  dateRange: 'all',
};

describe('DmsDocumentToolbar', () => {
  it('updates search, clears active filters, and toggles sort direction', () => {
    const onSearchChange = jest.fn();
    const onClearFilters = jest.fn();
    const onSortDirectionChange = jest.fn();

    render(
      <DmsDocumentToolbar
        filters={{ ...filters, search: 'roadmap' }}
        sortKey="updatedAt"
        sortDirection="desc"
        folders={[]}
        uploaderOptions={['Alex']}
        activeFilterCount={1}
        hasActiveFilters
        visibleCount={1}
        totalCount={3}
        busy={false}
        onFiltersChange={jest.fn()}
        onSearchChange={onSearchChange}
        onClearFilters={onClearFilters}
        onSortKeyChange={jest.fn()}
        onSortDirectionChange={onSortDirectionChange}
        onRefresh={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search documents/i), {
      target: { value: 'budget' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('budget');

    fireEvent.click(screen.getByRole('button', { name: /^Clear filters$/i }));
    expect(onClearFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Desc/i }));
    expect(onSortDirectionChange).toHaveBeenCalledWith('asc');
  });
});
