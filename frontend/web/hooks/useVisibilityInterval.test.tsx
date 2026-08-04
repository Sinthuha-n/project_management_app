import { act, render } from '@testing-library/react';
import { useVisibilityInterval } from './useVisibilityInterval';

function Harness({ callback, enabled = true }: { callback: () => void; enabled?: boolean }) {
  useVisibilityInterval(callback, 1_000, enabled);
  return null;
}

describe('useVisibilityInterval', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('refreshes only when the document is visible and catches up on return', () => {
    const callback = jest.fn();
    let visibilityState: DocumentVisibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilityState });
    render(<Harness callback={callback} />);

    act(() => jest.advanceTimersByTime(1_000));
    expect(callback).not.toHaveBeenCalled();

    visibilityState = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe when disabled', () => {
    const callback = jest.fn();
    render(<Harness callback={callback} enabled={false} />);
    act(() => jest.advanceTimersByTime(3_000));
    expect(callback).not.toHaveBeenCalled();
  });
});
