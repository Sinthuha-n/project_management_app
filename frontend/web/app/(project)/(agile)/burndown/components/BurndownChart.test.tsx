import type { ReactElement, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import BurndownChart from './BurndownChart';

jest.mock('recharts', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;

  return {
    CartesianGrid: Empty,
    Line: Empty,
    LineChart: Wrapper,
    ReferenceLine: Empty,
    ResponsiveContainer: Wrapper,
    Tooltip: ({ content }: { content: ReactElement<Record<string, unknown>> }) => React.cloneElement(content, {
      active: true,
      label: '2026-04-08',
      payload: [{
        payload: {
          date: '2026-04-08',
          remainingPoints: 8,
          idealPoints: 10,
          completedPoints: 12,
          dailyBurn: 3,
          isToday: true,
        },
      }],
    }),
    XAxis: Empty,
    YAxis: Empty,
  };
});

describe('BurndownChart', () => {
  it('renders trajectory details without exposing variance', () => {
    render(
      <BurndownChart
        sprintName="Sprint 1"
        totalStoryPoints={20}
        dataPoints={[
          { date: '2026-04-01', remainingPoints: 20, idealPoints: 20, completedPoints: 0, dailyBurn: 0 },
          { date: '2026-04-08', remainingPoints: 8, idealPoints: 10, completedPoints: 12, dailyBurn: 3, isToday: true },
        ]}
      />
    );

    expect(screen.getByText('Actual remaining')).toBeInTheDocument();
    expect(screen.getAllByText('Ideal').length).toBeGreaterThan(0);
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Daily burn')).toBeInTheDocument();
    expect(screen.getByText('8 pts')).toBeInTheDocument();
    expect(screen.queryByText(/variance/i)).not.toBeInTheDocument();
  });
});
