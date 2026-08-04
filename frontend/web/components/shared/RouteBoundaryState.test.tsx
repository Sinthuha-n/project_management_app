import { render, screen } from '@testing-library/react';
import { RouteErrorState, RouteLoadingState } from './RouteBoundaryState';

describe('route boundary states', () => {
  it('announces loading state without exposing decorative skeletons', () => {
    render(<RouteLoadingState title="Loading board" subtitle="Fetching tasks" variant="board" />);

    expect(screen.getByRole('status', { name: 'Loading board' })).toHaveAttribute('aria-busy', 'true');
  });

  it('provides an actionable, announced recovery state', () => {
    const retry = jest.fn();
    render(<RouteErrorState title="Unable to load" subtitle="Try again" onRetry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load');
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
