import {
  formatDateOnly,
  formatDateTime,
  formatRelativeTime,
  isValidTimeZone,
  parseDateOnly,
  parseInstant,
} from './date-time';

describe('date-time utilities', () => {
  it('parses explicit UTC and offset timestamps as the same instant', () => {
    expect(parseInstant('2026-07-14T10:30:00Z')?.toISOString()).toBe('2026-07-14T10:30:00.000Z');
    expect(parseInstant('2026-07-14T16:00:00+05:30')?.toISOString()).toBe('2026-07-14T10:30:00.000Z');
  });

  it('treats legacy offset-less timestamps as UTC', () => {
    expect(parseInstant('2026-07-14T10:30:00')?.toISOString()).toBe('2026-07-14T10:30:00.000Z');
  });

  it('keeps calendar dates unchanged', () => {
    expect(formatDateOnly(parseDateOnly('2026-07-14'))).toBe('2026-07-14');
    expect(parseInstant('2026-07-14')).toBeNull();
  });

  it('formats an instant in the requested IANA timezone', () => {
    const value = '2026-07-14T10:30:00Z';
    expect(formatDateTime(value, { hour12: false }, 'Asia/Colombo')).toContain('16:00');
    expect(formatDateTime(value, { hour12: false }, 'America/Los_Angeles')).toContain('03:30');
  });

  it('validates zones and handles relative future and invalid values', () => {
    expect(isValidTimeZone('Asia/Colombo')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(formatRelativeTime('bad-value')).toBe('recently');
    expect(formatRelativeTime('2026-07-14T10:31:00Z', Date.parse('2026-07-14T10:30:00Z'))).toBe('in 1 minute');
  });
});
