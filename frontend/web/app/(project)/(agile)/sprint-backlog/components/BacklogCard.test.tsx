import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BacklogCard from './BacklogCard';
import { ACCESS_DENIED_MESSAGE, ACCESS_DENIED_TITLE } from '@/lib/project-permissions';
import type { SprintItem } from '@/types';

const mockSprint: SprintItem = {
  id: 101,
  name: 'Sprint 1',
  status: 'NOT_STARTED',
  startDate: '2026-01-01',
  endDate: '2026-01-14',
  goal: 'Sprint 1 goal',
  tasks: [
    {
      id: 1,
      taskNo: 1,
      projectTaskNumber: 1,
      title: 'Task 1',
      storyPoints: 3,
      selected: false,
      assigneeName: 'Alice',
      status: 'TODO',
      assignees: [],
    },
  ],
};

const defaultProps = {
  sprint: mockSprint,
  projectId: '123',
  projectKey: 'TEST',
  onDropTask: jest.fn(),
  onCreateTask: jest.fn(),
  onDeleteTask: jest.fn(),
  onToggleTask: jest.fn(),
  onSprintDeleted: jest.fn(),
  onSprintUpdated: jest.fn(),
};

describe('BacklogCard Role-Based Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('When user is Project Member', () => {
    it('shows Access Denied modal when Member clicks Start Sprint', () => {
      render(<BacklogCard {...defaultProps} currentUserRole="MEMBER" />);

      const startSprintBtn = screen.getByRole('button', { name: /start sprint/i });
      fireEvent.click(startSprintBtn);

      expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
      expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
    });

    it('shows Access Denied modal when Member clicks Delete Sprint from sprint menu', () => {
      render(<BacklogCard {...defaultProps} currentUserRole="MEMBER" />);

      const menuBtn = screen.getByLabelText('Sprint actions');
      fireEvent.click(menuBtn);

      const deleteSprintBtn = screen.getByRole('button', { name: /delete sprint/i });
      fireEvent.click(deleteSprintBtn);

      expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
      expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
    });

    it('shows Access Denied modal when Member clicks Delete Task', async () => {
      render(<BacklogCard {...defaultProps} currentUserRole="MEMBER" />);

      const deleteTaskBtn = await screen.findByTitle('Delete task');
      fireEvent.click(deleteTaskBtn);

      expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
      expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
      expect(defaultProps.onDeleteTask).not.toHaveBeenCalled();
    });
  });

  describe('When user is Project Owner or Admin', () => {
    it('opens Start Sprint modal for Project Owner without showing Access Denied', () => {
      render(<BacklogCard {...defaultProps} currentUserRole="OWNER" />);

      const startSprintBtn = screen.getByRole('button', { name: /start sprint/i });
      fireEvent.click(startSprintBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
    });

    it('opens Start Sprint modal for Project Admin without showing Access Denied', () => {
      render(<BacklogCard {...defaultProps} currentUserRole="ADMIN" />);

      const startSprintBtn = screen.getByRole('button', { name: /start sprint/i });
      fireEvent.click(startSprintBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
    });

    it('opens Delete Sprint confirmation modal for Project Owner', () => {
      render(<BacklogCard {...defaultProps} currentUserRole="OWNER" />);

      const menuBtn = screen.getByLabelText('Sprint actions');
      fireEvent.click(menuBtn);

      const deleteSprintBtn = screen.getByRole('button', { name: /delete sprint/i });
      fireEvent.click(deleteSprintBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete "Sprint 1"\?/i)).toBeInTheDocument();
    });

    it('opens Delete Task confirmation modal for Project Admin', async () => {
      render(<BacklogCard {...defaultProps} currentUserRole="ADMIN" />);

      const deleteTaskBtn = await screen.findByTitle('Delete task');
      fireEvent.click(deleteTaskBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this task\?/i)).toBeInTheDocument();
    });
  });
});
