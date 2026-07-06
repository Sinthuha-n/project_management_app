import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaskCardModal from './TaskCardModal';

jest.mock('./TaskHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="task-header">header</div>,
}));

jest.mock('./TaskMainContent', () => ({
  __esModule: true,
  default: () => <div data-testid="task-main">main</div>,
}));

jest.mock('./TaskSidebar', () => ({
  __esModule: true,
  default: ({ onCreateGitHubIssue, githubIssueNumber }: { onCreateGitHubIssue?: () => void; githubIssueNumber?: number | null }) => (
    <div data-testid="task-sidebar">
      <span data-testid="issue-number">{githubIssueNumber ?? 'none'}</span>
      <button onClick={onCreateGitHubIssue}>open-issue-modal</button>
    </div>
  ),
}));

jest.mock('@/components/github/CreateIssueFromTaskModal', () => ({
  __esModule: true,
  default: ({ open, taskId, onCreated }: { open: boolean; taskId?: number; onCreated: (issue: { number: number }) => void }) => (
    open ? (
      <div data-testid="issue-modal">
        <span data-testid="modal-task-id">{taskId}</span>
        <button onClick={() => onCreated({ number: 99 })}>simulate-created</button>
      </div>
    ) : null
  ),
}));

jest.mock('@/services/github-service', () => ({
  getProjectGitHubRepo: jest.fn(() => ({ repoFullName: 'owner/repo' })),
}));

jest.mock('@/ws/stomp-provider', () => ({
  useStomp: () => ({ subscribe: jest.fn() }),
}));

jest.mock('@/components/ui', () => ({
  toast: jest.fn(),
}));

jest.mock('@/services/auth-contract', () => ({
  authApi: {
    getCurrentUser: jest.fn(async () => ({ userId: 7 })),
  },
}));

jest.mock('@/services/api-contract', () => ({
  tasksApi: {
    get: jest.fn(async () => ({
      id: 1,
      title: 'Task title',
      description: 'Task description',
      projectId: 10,
      projectName: 'Project',
      status: 'TODO',
      priority: 'HIGH',
      storyPoint: 2,
      reporterName: 'Reporter',
      assigneeName: 'Assignee',
      sprintName: 'Sprint',
      labels: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      dueDate: null,
      subtasks: [],
      dependencies: [],
    })),
  },
  projectsApi: {
    get: jest.fn(async () => ({ teamId: 1 })),
    getMembers: jest.fn(async () => []),
  },
  labelsApi: {
    listByProject: jest.fn(async () => []),
  },
  sprintsApi: {
    listByProject: jest.fn(async () => []),
  },
}));

describe('TaskCardModal GitHub issue flow', () => {
  it('passes taskId to canonical modal and updates sidebar issue number on create', async () => {
    render(<TaskCardModal taskId={1} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('task-sidebar')).toBeInTheDocument();
    });

    expect(screen.getByTestId('issue-number')).toHaveTextContent('none');

    fireEvent.click(screen.getByText('open-issue-modal'));

    expect(screen.getByTestId('issue-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-task-id')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('simulate-created'));

    await waitFor(() => {
      expect(screen.getByTestId('issue-number')).toHaveTextContent('99');
    });
  });
});
