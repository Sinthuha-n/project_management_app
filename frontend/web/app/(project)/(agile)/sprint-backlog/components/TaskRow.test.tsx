import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskRow, { type TaskRowTask, type TaskRowTeamMember } from './TaskRow';
import { classifyDue, DUE_CHIP_STYLES } from './task-row/TaskRowConstants';

const mockTask: TaskRowTask = {
  id: 1,
  taskNo: 42,
  title: 'Test task title',
  storyPoints: 3,
  selected: false,
  assigneeName: 'Alice',
  assigneePhotoUrl: null,
  status: 'TODO',
  dueDate: '2030-01-01',
  priority: 'MEDIUM',
};

const mockTeamMembers: TaskRowTeamMember[] = [
  { id: 1, user: { userId: 10, fullName: 'Alice Smith', username: 'alice', profilePicUrl: null } },
];

const noop = jest.fn();
const noopAsync = jest.fn().mockResolvedValue(undefined);

const defaultProps = {
  task: mockTask,
  teamMembers: mockTeamMembers,
  loadingMembers: false,
  canDelete: true,
  showCheckbox: true,
  onToggle: noop,
  onStatusChange: noop,
  onStoryPointsChange: noop,
  onRenameTask: noopAsync,
  onAssignTask: noopAsync,
  onDueDateChange: noop,
  onDeleteTask: noop,
  onOpenTask: noop,
};

describe('TaskRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders task number and title', () => {
    render(<TaskRow {...defaultProps} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Test task title')).toBeInTheDocument();
  });

  it('renders MEDIUM priority badge', () => {
    render(<TaskRow {...defaultProps} />);
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('renders story points field with correct value', () => {
    render(<TaskRow {...defaultProps} />);
    const pointsInput = screen.getByRole('spinbutton');
    expect(pointsInput).toHaveValue(3);
  });

  it('calls onOpenTask when row is clicked', () => {
    render(<TaskRow {...defaultProps} />);
    fireEvent.click(screen.getByText('Test task title'));
    expect(noop).toHaveBeenCalledWith(1);
  });

  it('calls onDeleteTask when delete button is clicked', () => {
    render(<TaskRow {...defaultProps} />);
    const deleteBtn = screen.getByTitle('Delete task');
    fireEvent.click(deleteBtn);
    expect(noop).toHaveBeenCalledWith(1);
  });

  it('calls onToggle when checkbox is clicked', () => {
    render(<TaskRow {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(noop).toHaveBeenCalledWith(1);
  });

  it('renders DONE task with line-through style', () => {
    render(<TaskRow {...defaultProps} task={{ ...mockTask, status: 'DONE' }} />);
    const title = screen.getByText('Test task title');
    expect(title.className).toContain('line-through');
  });

  it('does not render checkbox when showCheckbox is false', () => {
    render(<TaskRow {...defaultProps} showCheckbox={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('disables delete button when canDelete is false', () => {
    render(<TaskRow {...defaultProps} canDelete={false} />);
    const deleteBtn = screen.getByTitle('Viewers cannot delete tasks');
    expect(deleteBtn).toBeDisabled();
  });

  it('submits an inline rename only once when Enter also blurs the input', async () => {
    const user = userEvent.setup();
    const onRenameTask = jest.fn().mockResolvedValue(undefined);
    render(<TaskRow {...defaultProps} onRenameTask={onRenameTask} />);

    await user.dblClick(screen.getByText('Test task title'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Renamed task{Enter}');

    await waitFor(() => expect(onRenameTask).toHaveBeenCalledTimes(1));
    expect(onRenameTask).toHaveBeenCalledWith(1, 'Renamed task');
  });
});

describe('classifyDue & due date styling', () => {

  const formatLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('classifies overdue as overdue with red style', () => {
    const past = formatLocal(new Date(Date.now() - 86400000 * 2));
    expect(classifyDue(past, 'TODO')).toBe('overdue');
    expect(DUE_CHIP_STYLES.overdue).toContain('B42318');
  });

  it('classifies today as today with red style', () => {
    const today = formatLocal(new Date());
    expect(classifyDue(today, 'TODO')).toBe('today');
    expect(DUE_CHIP_STYLES.today).toContain('B42318');
  });

  it('classifies due within 5 days as five_days with amber style', () => {
    const in3Days = formatLocal(new Date(Date.now() + 86400000 * 3));
    expect(classifyDue(in3Days, 'TODO')).toBe('five_days');
    expect(DUE_CHIP_STYLES.five_days).toContain('B54708');
  });

  it('classifies due after 5 days as future with neutral style', () => {
    const in10Days = formatLocal(new Date(Date.now() + 86400000 * 10));
    expect(classifyDue(in10Days, 'TODO')).toBe('future');
    expect(DUE_CHIP_STYLES.future).toContain('344054');
  });

  it('returns none for completed tasks or missing due date', () => {
    const past = formatLocal(new Date(Date.now() - 86400000 * 2));
    expect(classifyDue(past, 'DONE')).toBe('none');
    expect(classifyDue(undefined, 'TODO')).toBe('none');
  });
});
