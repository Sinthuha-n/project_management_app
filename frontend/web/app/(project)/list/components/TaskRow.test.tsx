import { fireEvent, render, screen } from '@testing-library/react';
import TaskRow, { DesktopTaskRow, MobileTaskRow, type TaskRowProps } from './TaskRow';

const task = {
  id: 10,
  title: 'Polish list page responsiveness',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  dueDate: '2030-02-14',
  assigneeId: 1,
  assigneeName: 'Alex Rivera',
  assignees: [{ id: 1, name: 'Alex Rivera' }],
  labels: [{ id: 2, name: 'Frontend', color: '#155DFC' }],
  milestoneId: 3,
  milestoneName: 'Launch',
} as TaskRowProps['task'];

const defaultProps: TaskRowProps = {
  task,
  selected: false,
  members: [{ id: 1, name: 'Alex Rivera' }],
  availableLabels: [{ id: 2, name: 'Frontend', color: '#155DFC' }],
  milestones: [{
    id: 3,
    projectId: 1,
    name: 'Launch',
    status: 'OPEN',
    taskCount: 1,
    completedTaskCount: 0,
    progressPercent: 0,
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
  }],
  projectStatuses: [{ status: 'IN_PROGRESS', name: 'In Progress', color: 'bg-blue-50 text-blue-700' }],
  canModifyTasks: true,
  showArchived: false,
  onOpenModal: jest.fn(),
  onStatusChange: jest.fn(),
  onDelete: jest.fn(),
  onArchive: jest.fn(),
  onRestore: jest.fn(),
  onDueDateChange: jest.fn(),
  onAssigneesChange: jest.fn(),
  onToggleLabel: jest.fn(),
  onMilestoneChange: jest.fn(),
  onToggleSelect: jest.fn(),
  onPriorityChange: jest.fn(),
};

describe('TaskRow responsive surfaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the desktop row with task essentials', () => {
    render(<DesktopTaskRow {...defaultProps} />);

    const row = screen.getByTestId('desktop-task-row');
    expect(row).toBeInTheDocument();
    expect(row).toHaveClass('hidden', 'md:grid');
    expect(screen.getByText('Polish list page responsiveness')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getAllByText('Frontend').length).toBeGreaterThan(0);
    expect(screen.getByText('Launch')).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
  });

  it('renders the compact mobile row with the same essential metadata', () => {
    render(<MobileTaskRow {...defaultProps} />);

    expect(screen.getByTestId('mobile-task-row')).toBeInTheDocument();
    expect(screen.getByText('Polish list page responsiveness')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Feb 14')).toBeInTheDocument();
    expect(screen.getAllByText('Frontend').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Status: In Progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Milestone: Launch/i })).toBeInTheDocument();
  });

  it('renders compact editable mobile row controls', () => {
    render(<MobileTaskRow {...defaultProps} />);

    expect(screen.getByTestId('mobile-task-row')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /select polish list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions for polish list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Priority: High/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Status: In Progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Due date: Feb 14/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assignee: Alex Rivera/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 label/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Milestone: Launch/i })).toBeInTheDocument();
  });

  it('falls back to To Do when a task status is missing', () => {
    render(
      <DesktopTaskRow
        {...defaultProps}
        task={{ ...task, status: null } as TaskRowProps['task']}
        projectStatuses={[{ status: null as unknown as string, name: '', color: '' }]}
      />,
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('opens the task from row click and toggles selection from the checkbox', () => {
    render(<TaskRow {...defaultProps} />);

    fireEvent.click(screen.getAllByText('Polish list page responsiveness')[0]);
    expect(defaultProps.onOpenModal).toHaveBeenCalledWith(10);

    fireEvent.click(screen.getAllByRole('checkbox', { name: /select polish list/i })[0]);
    expect(defaultProps.onToggleSelect).toHaveBeenCalledWith(10);
  });
});
