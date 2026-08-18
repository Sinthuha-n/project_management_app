import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BacklogFilterBar from './BacklogFilterBar';
import { DEFAULT_BACKLOG_STATUS_OPTIONS } from '../status-options';

jest.mock('../../kanban/components/DateRangeFilter', () => ({
  __esModule: true,
  default: () => <div data-testid="date-range-filter" />,
}));

const renderFilterBar = (setFilterStatus = jest.fn()) => render(
  <BacklogFilterBar
    searchTerm=""
    setSearchTerm={jest.fn()}
    filterPriority={[]}
    setFilterPriority={jest.fn()}
    filterStatus={[]}
    setFilterStatus={setFilterStatus}
    filterAssignee=""
    setFilterAssignee={jest.fn()}
    filterLabel={null}
    setFilterLabel={jest.fn()}
    filterDateRange={{ startDate: null, endDate: null }}
    setFilterDateRange={jest.fn()}
    groupBy="none"
    setGroupBy={jest.fn()}
    showArchived={false}
    setShowArchived={jest.fn()}
    teamMembers={[]}
    labels={[]}
    statusOptions={[
      ...DEFAULT_BACKLOG_STATUS_OPTIONS,
      { status: 'QA_READY', title: 'QA Ready' },
    ]}
  />
);

describe('BacklogFilterBar', () => {
  it('shows custom Kanban status options in the status filter', () => {
    const setFilterStatus = jest.fn();
    renderFilterBar(setFilterStatus);

    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.click(screen.getByRole('button', { name: /all status/i }));
    fireEvent.click(screen.getByRole('button', { name: /qa ready/i }));

    expect(setFilterStatus).toHaveBeenCalledWith(['QA_READY']);
  });
});
