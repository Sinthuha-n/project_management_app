import { fireEvent, render, screen } from '@testing-library/react';
import ListFilterBar from './ListFilterBar';
import type { ListFilters } from './ListFilterBar';

const baseFilters: ListFilters = {
  search: '',
  statuses: [],
  priorities: [],
  assignee: '',
};

describe('ListFilterBar', () => {
  it('updates search text', () => {
    const onChange = jest.fn();
    render(
      <ListFilterBar
        filters={baseFilters}
        onChange={onChange}
        assigneeNames={['Alex']}
        groupBy="none"
        onGroupByChange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Search tasks or assignees'), {
      target: { value: 'design' },
    });

    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, search: 'design' });
  });

  it('selects status and group options from explicit menus', () => {
    const onChange = jest.fn();
    const onGroupByChange = jest.fn();
    render(
      <ListFilterBar
        filters={baseFilters}
        onChange={onChange}
        assigneeNames={['Alex']}
        groupBy="none"
        onGroupByChange={onGroupByChange}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: /^Status/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /To Do/i }));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, statuses: ['TODO'] });
    fireEvent.keyDown(screen.getByRole('menu', { name: /Status/i }), { key: 'Escape' });

    fireEvent.keyDown(screen.getByRole('button', { name: /Group: None/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /^Status$/i }));
    expect(onGroupByChange).toHaveBeenCalledWith('status');
  });

  it('renders active filter chips and clears one chip', () => {
    const onChange = jest.fn();
    render(
      <ListFilterBar
        filters={{ ...baseFilters, priorities: ['HIGH'] }}
        onChange={onChange}
        assigneeNames={[]}
        groupBy="none"
        onGroupByChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /High/i }));
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, priorities: [] });
  });
});
