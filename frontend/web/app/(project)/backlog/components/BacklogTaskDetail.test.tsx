import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BacklogTaskDetail from './BacklogTaskDetail';
import type { Task } from '../../kanban/types';
import { DEFAULT_BACKLOG_STATUS_OPTIONS } from '../status-options';

const task: Task = {
  id: 42,
  title: 'Review task',
  status: 'TODO',
  priority: 'MEDIUM',
};

describe('BacklogTaskDetail', () => {
  it('includes custom Kanban status buttons', () => {
    const onStatusChange = jest.fn();

    render(
      <BacklogTaskDetail
        task={task}
        onStatusChange={onStatusChange}
        onMarkDone={jest.fn()}
        onDelete={jest.fn()}
        onOpenModal={jest.fn()}
        onClose={jest.fn()}
        statusOptions={[
          ...DEFAULT_BACKLOG_STATUS_OPTIONS,
          { status: 'QA_READY', title: 'QA Ready' },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /qa ready/i }));

    expect(onStatusChange).toHaveBeenCalledWith(42, 'QA_READY');
  });
});
