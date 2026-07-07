import { formatLocalDate } from './date-format';

describe('formatLocalDate', () => {
  it('preserves the local calendar date in a fixed non-UTC timezone', () => {
    const localDate = new Date(2025, 0, 15);

    expect(localDate.getTimezoneOffset()).not.toBe(0);
    expect(localDate.toISOString().split('T')[0]).toBe('2025-01-14');
    expect(formatLocalDate(localDate)).toBe('2025-01-15');
  });
});
