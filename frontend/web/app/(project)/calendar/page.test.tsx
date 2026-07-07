import { render, screen, waitFor } from '@testing-library/react';
import CalendarPage from './page';
import { fetchCalendarEvents } from './api';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('./api', () => ({
  fetchCalendarEvents: jest.fn(),
  patchTaskDates: jest.fn(),
}));

jest.mock('./components/MonthCalendarView', () => ({
  __esModule: true,
  default: () => <div data-testid="month-view">Month View</div>,
}));

jest.mock('@/app/taskcard/TaskCardModal', () => ({
  __esModule: true,
  default: () => <div data-testid="task-card-modal" />,
}));

const mockedFetchCalendarEvents = fetchCalendarEvents as jest.Mock;
const mockedUseSearchParams = useSearchParams as jest.Mock;

describe('CalendarPage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders the modern calendar shell and fetches events', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-101',
        taskId: 101,
        title: 'Meeting',
        kind: 'task',
        status: 'To Do',
        dueDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByText('1 visible of 1 scheduled item')).toBeInTheDocument();
    expect(mockedFetchCalendarEvents).toHaveBeenCalledWith('123');
  });

  it('offers a route back to the dashboard when no project is selected', () => {
    mockedUseSearchParams.mockReturnValue({
      get: () => null,
    });

    render(<CalendarPage />);

    expect(screen.getByText('Select a project to view its calendar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('uses the saved project when the URL has no project ID', async () => {
    localStorage.setItem('currentProjectId', '456');
    mockedUseSearchParams.mockReturnValue({
      get: () => null,
    });
    mockedFetchCalendarEvents.mockResolvedValue([
      {
        id: 'task-1',
        taskId: 1,
        title: 'Saved project task',
        kind: 'task',
        dueDate: '2026-04-03',
      },
    ]);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });
    expect(mockedFetchCalendarEvents).toHaveBeenCalledWith('456');
  });

  it('shows an empty scheduled-work state when the project has no calendar items', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedFetchCalendarEvents.mockResolvedValue([]);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('No scheduled work yet')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('month-view')).not.toBeInTheDocument();
  });
});
