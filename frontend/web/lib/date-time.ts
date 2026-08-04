const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_OFFSET_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

export type DateTimeInput = string | number | Date | null | undefined;

export function resolveBrowserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return 'UTC';
    // Constructing the formatter validates the IANA identifier.
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format();
    return zone;
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses an absolute API timestamp. Offset-less legacy timestamps are treated
 * as UTC; interpreting them as browser-local time is the source of the
 * production timezone drift this compatibility path is designed to prevent.
 */
export function parseInstant(value: DateTimeInput): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }

  let normalized: string | number = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || DATE_ONLY_PATTERN.test(trimmed)) return null;
    normalized = EXPLICIT_OFFSET_PATTERN.test(trimmed) ? trimmed : `${trimmed}Z`;
  }

  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Parse a calendar date without applying a timezone conversion. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return null;
  return parsed;
}

export function formatDateOnly(value: Date | string | null | undefined): string {
  const date = typeof value === 'string' ? parseDateOnly(value) : value;
  if (!date || !Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeZone(timeZone?: string): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : resolveBrowserTimeZone();
}

function hasComponentOptions(options: Intl.DateTimeFormatOptions): boolean {
  return ['weekday', 'era', 'year', 'month', 'day', 'dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits']
    .some((key) => options[key as keyof Intl.DateTimeFormatOptions] !== undefined);
}

export function formatDateTime(
  value: DateTimeInput,
  options: Intl.DateTimeFormatOptions = {},
  timeZone?: string,
): string {
  const date = parseInstant(value);
  if (!date) return '';
  const defaults: Intl.DateTimeFormatOptions = hasComponentOptions(options) || options.dateStyle || options.timeStyle
    ? {}
    : { dateStyle: 'medium', timeStyle: 'short' };
  return new Intl.DateTimeFormat(undefined, {
    ...defaults,
    ...options,
    timeZone: safeZone(timeZone),
  }).format(date);
}

export function formatDate(
  value: DateTimeInput,
  options: Intl.DateTimeFormatOptions = {},
  timeZone?: string,
): string {
  const date = parseInstant(value);
  if (!date) return '';
  const defaults: Intl.DateTimeFormatOptions = hasComponentOptions(options) || options.dateStyle ? {} : { dateStyle: 'medium' };
  return new Intl.DateTimeFormat(undefined, {
    ...defaults,
    ...options,
    timeZone: safeZone(timeZone),
  }).format(date);
}

export function formatTime(
  value: DateTimeInput,
  options: Intl.DateTimeFormatOptions = {},
  timeZone?: string,
): string {
  const date = parseInstant(value);
  if (!date) return '';
  const defaults: Intl.DateTimeFormatOptions = hasComponentOptions(options) || options.timeStyle ? {} : { timeStyle: 'short' };
  return new Intl.DateTimeFormat(undefined, {
    ...defaults,
    ...options,
    timeZone: safeZone(timeZone),
  }).format(date);
}

export function formatRelativeTime(value: DateTimeInput, now = Date.now()): string {
  const date = parseInstant(value);
  if (!date) return 'recently';

  const deltaMs = date.getTime() - now;
  const absoluteMs = Math.abs(deltaMs);
  if (absoluteMs < 45_000) return deltaMs > 0 ? 'in a moment' : 'just now';

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 86_400_000],
    ['month', 30 * 86_400_000],
    ['week', 7 * 86_400_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  const [unit, size] = units.find(([, unitMs]) => absoluteMs >= unitMs) ?? units[units.length - 1];
  return formatter.format(Math.round(deltaMs / size), unit);
}
