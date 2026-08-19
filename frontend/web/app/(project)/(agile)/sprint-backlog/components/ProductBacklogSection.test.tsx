import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductBacklogSection from './ProductBacklogSection';
import { ACCESS_DENIED_MESSAGE, ACCESS_DENIED_TITLE } from '@/lib/project-permissions';
import type { TaskItem } from '@/types';

const mockTasks: TaskItem[] = [
  {
    id: 1,
    taskNo: 1,
    projectTaskNumber: 1,
    title: 'Backlog Item 1',
    storyPoints: 5,
    selected: false,
    assigneeName: 'Bob',
    status: 'TODO',
    assignees: [],
  },
];

const defaultProps = {
  tasks: mockTasks,
  projectId: '123',
  projectKey: 'TEST',
  sprintCount: 0,
  onToggleTask: jest.fn(),
  onStoryPointsChange: jest.fn(),
  onCreateTask: jest.fn(),
  onDeleteTask: jest.fn(),
  onCreateSprint: jest.fn(),
  onDropTask: jest.fn(),
  onAssignTask: jest.fn(),
  onStatusChange: jest.fn(),
};

describe('ProductBacklogSection Role-Based Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('When user is Project Member', () => {
    it('shows Access Denied modal when Member clicks Create Sprint', () => {
      render(<ProductBacklogSection {...defaultProps} currentUserRole="MEMBER" />);

      const createSprintBtn = screen.getByRole('button', { name: /create sprint/i });
      fireEvent.click(createSprintBtn);

      expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
      expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
      expect(defaultProps.onCreateSprint).not.toHaveBeenCalled();
    });

    it('shows Access Denied modal when Member clicks Delete Task', () => {
      render(<ProductBacklogSection {...defaultProps} currentUserRole="MEMBER" />);

      const deleteTaskBtn = screen.getByTitle('Delete task');
      fireEvent.click(deleteTaskBtn);

      expect(screen.getByText(ACCESS_DENIED_TITLE)).toBeInTheDocument();
      expect(screen.getByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
      expect(defaultProps.onDeleteTask).not.toHaveBeenCalled();
    });
  });

  describe('When user is Project Owner or Admin', () => {
    it('calls onCreateSprint when Project Owner clicks Create Sprint', () => {
      render(<ProductBacklogSection {...defaultProps} currentUserRole="OWNER" />);

      const createSprintBtn = screen.getByRole('button', { name: /create sprint/i });
      fireEvent.click(createSprintBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
      expect(defaultProps.onCreateSprint).toHaveBeenCalledTimes(1);
    });

    it('calls onCreateSprint when Project Admin clicks Create Sprint', () => {
      render(<ProductBacklogSection {...defaultProps} currentUserRole="ADMIN" />);

      const createSprintBtn = screen.getByRole('button', { name: /create sprint/i });
      fireEvent.click(createSprintBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
      expect(defaultProps.onCreateSprint).toHaveBeenCalledTimes(1);
    });

    it('opens Delete Task confirmation modal when Project Owner clicks Delete Task', () => {
      render(<ProductBacklogSection {...defaultProps} currentUserRole="OWNER" />);

      const deleteTaskBtn = screen.getByTitle('Delete task');
      fireEvent.click(deleteTaskBtn);

      expect(screen.queryByText(ACCESS_DENIED_MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this task\?/i)).toBeInTheDocument();
    });
  });
});
