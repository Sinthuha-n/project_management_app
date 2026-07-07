import type { CalendarEventItem } from '../types';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  return addDays(d, -day);
};

export const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);

export const startOfMonthGrid = (date: Date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return addDays(first, -first.getDay());
};

export const endOfMonthGrid = (date: Date) => {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return addDays(last, 6 - last.getDay());
};

export const toDate = (value?: string) => {
  if (!value) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const isDateInRange = (date: Date, start?: string, end?: string) => {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate && !endDate) return false;

  const dateStart = startOfDay(date).getTime();
  const left = startDate ? startOfDay(startDate).getTime() : Number.MIN_SAFE_INTEGER;
  const right = endDate ? endOfDay(endDate).getTime() : Number.MAX_SAFE_INTEGER;

  return dateStart >= left && dateStart <= right;
};

export const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const formatWeekLabel = (date: Date) => {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const left = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const right = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${left} - ${right}`;
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isToday = (date: Date) => isSameDay(date, new Date());

export const getEventStartDate = (event: CalendarEventItem) =>
  toDate(event.startDate || event.dueDate || event.endDate);

export const getEventEndDate = (event: CalendarEventItem) =>
  toDate(event.endDate || event.dueDate || event.startDate);

export const eventOccursOnDay = (event: CalendarEventItem, day: Date) => {
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  if (!start && !end) return false;

  const left = start ?? end;
  const right = end ?? start;
  if (!left || !right) return false;

  return isDateInRange(day, toDateKey(left), toDateKey(right));
};

export const getEventsForDay = (events: CalendarEventItem[], day: Date) =>
  events
    .filter((event) => eventOccursOnDay(event, day))
    .sort(sortCalendarEvents);

export const buildMonthGrid = (date: Date) => {
  const gridStart = startOfMonthGrid(date);
  const gridEnd = endOfMonthGrid(date);
  const days: Date[] = [];

  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(new Date(day));
  }

  return days;
};

export const splitVisibleEvents = (events: CalendarEventItem[], visibleCount = 3) => ({
  visible: events.slice(0, visibleCount),
  hidden: events.slice(visibleCount),
});

export const isEventOverdue = (event: CalendarEventItem, referenceDate = new Date()) => {
  if (event.kind === 'sprint') return false;
  const due = toDate(event.dueDate || event.endDate || event.startDate);
  if (!due) return false;
  const normalizedStatus = (event.status || '').toUpperCase().replace(/\s+/g, '_');
  if (normalizedStatus === 'DONE' || normalizedStatus === 'COMPLETED') return false;
  return startOfDay(due) < startOfDay(referenceDate);
};

export const getCalendarSummary = (events: CalendarEventItem[], referenceDate = new Date()) => {
  const scheduled = events.filter((event) => getEventStartDate(event) || getEventEndDate(event)).length;
  const overdue = events.filter((event) => isEventOverdue(event, referenceDate)).length;
  const sprints = events.filter((event) => event.kind === 'sprint').length;
  const today = events.filter((event) => eventOccursOnDay(event, referenceDate)).length;

  return {
    total: events.length,
    scheduled,
    overdue,
    sprints,
    today,
  };
};

export const groupAgendaEvents = (events: CalendarEventItem[], currentDate: Date) => {
  const today = startOfDay(currentDate);
  const tomorrow = addDays(today, 1);
  const thisWeekEnd = endOfWeek(today);

  const groups = [
    { key: 'overdue', label: 'Overdue', events: [] as CalendarEventItem[] },
    { key: 'today', label: 'Today', events: [] as CalendarEventItem[] },
    { key: 'tomorrow', label: 'Tomorrow', events: [] as CalendarEventItem[] },
    { key: 'this-week', label: 'This week', events: [] as CalendarEventItem[] },
    { key: 'later', label: 'Later', events: [] as CalendarEventItem[] },
  ];

  const sorted = events
    .filter((event) => getEventStartDate(event) || getEventEndDate(event))
    .sort(sortCalendarEvents);

  sorted.forEach((event) => {
    const eventDate = startOfDay(getEventStartDate(event) ?? getEventEndDate(event) ?? currentDate);

    if (isEventOverdue(event, today)) groups[0].events.push(event);
    else if (isSameDay(eventDate, today)) groups[1].events.push(event);
    else if (isSameDay(eventDate, tomorrow)) groups[2].events.push(event);
    else if (eventDate <= thisWeekEnd) groups[3].events.push(event);
    else groups[4].events.push(event);
  });

  return groups;
};

export function sortCalendarEvents(a: CalendarEventItem, b: CalendarEventItem) {
  if (a.kind === 'sprint' && b.kind !== 'sprint') return -1;
  if (a.kind !== 'sprint' && b.kind === 'sprint') return 1;

  const aStart = getEventStartDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bStart = getEventStartDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (aStart !== bStart) return aStart - bStart;

  return a.title.localeCompare(b.title);
}
