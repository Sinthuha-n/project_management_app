import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BurndownPage from './page';
import api from '@/lib/axios';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/burndown'),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('./components/BurndownChart', () => ({
  __esModule: true,
  default: ({ sprintName }: { sprintName: string }) => <div data-testid="burndown-chart">Chart {sprintName}</div>,
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseSearchParams = useSearchParams as jest.Mock;

const sprints = [
  { id: 1, name: 'Sprint 1', startDate: '2026-04-01', endDate: '2026-04-14', status: 'ACTIVE' },
  { id: 2, name: 'Sprint 2', startDate: '2026-04-15', endDate: '2026-04-28', status: 'NOT_STARTED' },
];

const burndown = {
  sprintId: 1,
  sprintName: 'Sprint 1',
  startDate: '2026-04-01',
  endDate: '2026-04-14',
  totalStoryPoints: 20,
  dataPoints: [
    { date: '2026-04-01', remainingPoints: 20, idealPoints: 20, completedPoints: 0, dailyBurn: 0 },
    { date: '2026-04-08', remainingPoints: 8, idealPoints: 10, completedPoints: 12, dailyBurn: 3, isToday: true },
  ],
  summary: {
    totalStoryPoints: 20,
    completedStoryPoints: 12,
    remainingStoryPoints: 8,
    totalTasks: 5,
    completedTasks: 3,
    remainingTasks: 2,
    progressPercent: 60,
    daysElapsed: 8,
    daysRemaining: 6,
    idealRemainingPoints: 10,
    actualBurnRate: 1.5,
    requiredBurnRate: 1.3,
    projectedCompletionDate: '2026-04-13',
    healthStatus: 'ON_TRACK',
  },
  breakdown: {
    byStatus: [{ name: 'DONE', taskCount: 3, storyPoints: 12 }],
    byPriority: [{ name: 'HIGH', taskCount: 2, storyPoints: 8 }],
  },
  insights: ['1.3 pts/day required to finish on time.', 'Projected to finish within the sprint window.'],
};

describe('BurndownPage', () => {
  beforeEach(() => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });
    mockedApi.get.mockReset();
    mockedApi.put.mockReset();
  });

  it('renders loaded analytics and chart', async () => {
    mockSprintsAndBurndown();

    render(<BurndownPage />);

    expect(await screen.findByTestId('burndown-chart')).toHaveTextContent('Sprint 1');
    expect(screen.getAllByText('On track').length).toBeGreaterThan(0);
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('1.3 pts/day required to finish on time.')).toBeInTheDocument();
    expect(screen.getByText('Status mix')).toBeInTheDocument();
    expect(screen.queryByText(/variance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/(?:above|ahead of) the ideal/i)).not.toBeInTheDocument();
  });

  it('selects another sprint and refetches analytics', async () => {
    mockSprintsAndBurndown();
    render(<BurndownPage />);

    await screen.findByTestId('burndown-chart');
    await userEvent.click(screen.getByRole('button', { name: /sprint 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /sprint 2/i }));

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/api/burndown/sprint/2',
        expect.objectContaining({ params: expect.any(URLSearchParams) })
      );
    });
  });

  it('sends date range params when filters change', async () => {
    mockSprintsAndBurndown();
    render(<BurndownPage />);

    await screen.findByTestId('burndown-chart');
    fireEvent.change(screen.getByLabelText('Burndown end date'), { target: { value: '2026-04-10' } });

    await waitFor(() => {
      const calls = mockedApi.get.mock.calls.filter(([url]) => String(url).includes('/api/burndown/sprint/1'));
      const lastCall = calls[calls.length - 1];
      expect((lastCall[1]?.params as URLSearchParams).get('to')).toBe('2026-04-10');
    });
  });

  it('shows date setter when selected sprint is missing dates', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/sprints/project/')) {
        return Promise.resolve({ data: [{ id: 3, name: 'Undated Sprint', status: 'ACTIVE' }] });
      }
      return Promise.resolve({ data: burndown });
    });

    render(<BurndownPage />);

    expect(await screen.findByText('Start and end dates are required to view the burndown chart.')).toBeInTheDocument();
  });

  it('shows no-sprints state', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });

    render(<BurndownPage />);

    expect(await screen.findByText('No sprints found')).toBeInTheDocument();
  });

  it('shows zero-scope state', async () => {
    mockSprintsAndBurndown({
      ...burndown,
      totalStoryPoints: 0,
      summary: { ...burndown.summary, totalStoryPoints: 0, healthStatus: 'NO_SCOPE', progressPercent: 0 },
    });

    render(<BurndownPage />);

    expect(await screen.findByText('No estimated scope')).toBeInTheDocument();
  });

  it('shows retry path after burndown API failure', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/sprints/project/')) {
        return Promise.resolve({ data: sprints });
      }
      return Promise.reject(new Error('failed'));
    });

    render(<BurndownPage />);

    expect(await screen.findByText('Could not load burndown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

function mockSprintsAndBurndown(response = burndown) {
  mockedApi.get.mockImplementation((url: string) => {
    if (url.includes('/api/sprints/project/')) {
      return Promise.resolve({ data: sprints });
    }
    if (url.includes('/api/burndown/sprint/')) {
      const sprintId = Number(url.split('/').pop());
      return Promise.resolve({
        data: {
          ...response,
          sprintId,
          sprintName: sprintId === 2 ? 'Sprint 2' : response.sprintName,
        },
      });
    }
    return Promise.reject(new Error('unexpected url'));
  });
}
