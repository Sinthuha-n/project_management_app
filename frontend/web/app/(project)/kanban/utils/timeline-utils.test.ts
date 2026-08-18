import type { Task } from '../types';
import {
  buildTimelineTasks,
  dateToKey,
  filterTimelineTasks,
  getPageNumbers,
  getTaskSchedule,
  getTimelineInsights,
  groupTimelineTasks,
  paginateTimelineTasks,
  schedulePresetDates,
  TIMELINE_PAGE_SIZE_OPTIONS,
  type TimelineFilters,
} from './timeline-utils';

const baseFilters: TimelineFilters = {
  search: '',
  assignee: '',
  milestone: '',
  schedule: '',
  focus: '',
  hideWeekends: false,
  showDone: true,
};

const tasks: Task[] = [
  {
    id: 1,
    title: 'Build API',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: '2026-07-06',
    dueDate: '2026-07-08',
    assigneeName: 'Asha',
    milestoneId: 10,
    milestoneName: 'MVP',
    dependencies: [{ id: 99, title: 'Auth', relation: 'BLOCKED_BY', status: 'TODO' }],
  },
  {
    id: 2,
    title: 'QA pass',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '2026-07-03',
    assigneeName: 'Ben',
  },
  {
    id: 3,
    title: 'Write notes',
    status: 'DONE',
    assigneeName: 'Asha',
  },
];

const milestones = [{ id: 10, name: 'MVP', dueDate: '2026-07-07', status: 'ACTIVE' }];

describe('timeline utils', () => {
  it('calculates planning insights from task dates, dependencies, and milestones', () => {
    const insights = getTimelineInsights(tasks, milestones, new Date('2026-07-07T00:00:00'));

    expect(insights).toEqual({
      scheduled: 1,
      unscheduled: 2,
      overdue: 1,
      blocked: 1,
      dueThisWeek: 1,
      milestoneLinked: 1,
      pastMilestone: 1,
    });
  });

  it('filters by search, assignee, milestone, and done visibility', () => {
    expect(filterTimelineTasks(tasks, { ...baseFilters, search: 'api' }).map((task) => task.id)).toEqual([1]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, assignee: 'Ben' }).map((task) => task.id)).toEqual([2]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, milestone: '10' }).map((task) => task.id)).toEqual([1]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, showDone: false }).map((task) => task.id)).toEqual([1, 2]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, schedule: 'scheduled' }).map((task) => task.id)).toEqual([1]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, schedule: 'unscheduled' }).map((task) => task.id)).toEqual([2, 3]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, focus: 'blocked' }).map((task) => task.id)).toEqual([1]);
    expect(filterTimelineTasks(tasks, { ...baseFilters, focus: 'past-milestone' }, milestones).map((task) => task.id)).toEqual([1]);
  });

  it('builds timeline models and groups them by status, assignee, and milestone', () => {
    const visibleDays = [
      new Date(2026, 6, 6),
      new Date(2026, 6, 7),
      new Date(2026, 6, 8),
    ];
    const models = buildTimelineTasks(tasks, visibleDays, 38, milestones, null, 0, new Date('2026-07-07T00:00:00'));
    const apiTask = models.find((task) => task.id === 1);

    expect(models).toHaveLength(1);
    expect(apiTask).toMatchObject({ id: 1, leftPx: 0, widthPx: 108, durationDays: 3, isBlocked: true, isPastMilestone: true });
    expect(groupTimelineTasks(models, 'status').map((group) => group.label)).toEqual(expect.arrayContaining(['IN PROGRESS']));
    expect(groupTimelineTasks(models, 'assignee').map((group) => group.label)).toEqual(expect.arrayContaining(['Asha']));
    expect(groupTimelineTasks(models, 'milestone').map((group) => group.label)).toEqual(expect.arrayContaining(['MVP']));
  });

  it('uses date-only parsing and rejects missing or negative schedules', () => {
    expect(dateToKey(getTaskSchedule({ ...tasks[0], startDate: '2026-09-10', dueDate: '2026-09-15' })!.start)).toBe('2026-09-10');
    expect(dateToKey(getTaskSchedule({ ...tasks[0], startDate: '2026-09-10', dueDate: '2026-09-15' })!.due)).toBe('2026-09-15');
    expect(getTaskSchedule({ ...tasks[0], startDate: undefined, dueDate: '2026-09-15', createdAt: undefined })).toBeNull();
    expect(getTaskSchedule({ ...tasks[0], startDate: '2026-09-15', dueDate: '2026-09-10' })).toBeNull();
  });

  it('uses the task creation date as timeline start when board-created work only has a due date', () => {
    const boardTask: Task = {
      id: 6,
      title: 'Board-created task',
      status: 'TODO',
      createdAt: '2026-09-10T14:30:00Z',
      dueDate: '2026-09-15',
    };
    const visibleDays = Array.from({ length: 7 }, (_, index) => new Date(2026, 8, 10 + index));
    const models = buildTimelineTasks([boardTask], visibleDays, 10, [], null, 0, new Date(2026, 8, 10));

    expect(dateToKey(getTaskSchedule(boardTask)!.start)).toBe('2026-09-10');
    expect(dateToKey(getTaskSchedule(boardTask)!.due)).toBe('2026-09-15');
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({ leftPx: 0, widthPx: 54, durationDays: 6 });
  });

  it('prefers an explicit start date over the task creation date', () => {
    const task: Task = {
      id: 7,
      title: 'Explicitly scheduled task',
      status: 'TODO',
      createdAt: '2026-09-01T09:00:00Z',
      startDate: '2026-09-10',
      dueDate: '2026-09-12',
    };

    expect(dateToKey(getTaskSchedule(task)!.start)).toBe('2026-09-10');
    expect(dateToKey(getTaskSchedule(task)!.due)).toBe('2026-09-12');
  });

  it('renders inclusive cross-month and partially visible task bars without mutating dates', () => {
    const crossMonthTask: Task = {
      id: 4,
      title: 'Release bridge',
      status: 'TODO',
      startDate: '2026-09-28',
      dueDate: '2026-10-05',
    };
    const visibleDays = Array.from({ length: 16 }, (_, index) => new Date(2026, 8, 25 + index));
    const models = buildTimelineTasks([crossMonthTask], visibleDays, 10, [], null, 0, new Date(2026, 8, 25));

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({ leftPx: 30, widthPx: 74, durationDays: 8 });
    expect(dateToKey(models[0].startDateObj)).toBe('2026-09-28');
    expect(dateToKey(models[0].dueDateObj)).toBe('2026-10-05');

    const partial = buildTimelineTasks([
      { ...crossMonthTask, startDate: '2026-09-20', dueDate: '2026-09-27' },
      { ...crossMonthTask, id: 5, startDate: '2026-10-09', dueDate: '2026-10-20' },
    ], visibleDays, 10, [], null, 0, new Date(2026, 8, 25));

    expect(partial).toHaveLength(2);
    expect(partial[0]).toMatchObject({ leftPx: 0, widthPx: 30, durationDays: 8 });
    expect(partial[1]).toMatchObject({ leftPx: 140, widthPx: 30, durationDays: 12 });
  });

  it('creates schedule presets for unscheduled task actions', () => {
    expect(schedulePresetDates('today', new Date('2026-07-07T00:00:00'))).toEqual({
      startDate: '2026-07-07',
      dueDate: '2026-07-07',
    });
    expect(schedulePresetDates('week', new Date('2026-07-07T00:00:00'))).toEqual({
      startDate: '2026-07-07',
      dueDate: '2026-07-11',
    });
  });

  describe('getPageNumbers', () => {
    it('returns empty array when totalPages <= 0', () => {
      expect(getPageNumbers(1, 0)).toEqual([]);
      expect(getPageNumbers(1, -3)).toEqual([]);
    });

    it('returns all pages when totalPages <= maxVisible', () => {
      expect(getPageNumbers(1, 5, 7)).toEqual([1, 2, 3, 4, 5]);
      expect(getPageNumbers(3, 7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns left-anchored pages with right ellipsis when current page is low', () => {
      expect(getPageNumbers(1, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
      expect(getPageNumbers(4, 10, 7)).toEqual([1, 2, 3, 4, 5, '...', 10]);
    });

    it('returns right-anchored pages with left ellipsis when current page is high', () => {
      expect(getPageNumbers(7, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
      expect(getPageNumbers(10, 10, 7)).toEqual([1, '...', 6, 7, 8, 9, 10]);
    });

    it('returns middle window with dual ellipses when current page is in the middle', () => {
      expect(getPageNumbers(5, 10, 7)).toEqual([1, '...', 4, 5, 6, '...', 10]);
      expect(getPageNumbers(6, 12, 7)).toEqual([1, '...', 5, 6, 7, '...', 12]);
    });
  });

  describe('paginateTimelineTasks', () => {
    const sample = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}` }));

    it('returns correct slice of tasks for requested page', () => {
      const page1 = paginateTimelineTasks(sample, 1, 10);
      expect(page1).toHaveLength(10);
      expect(page1[0].id).toBe(1);
      expect(page1[9].id).toBe(10);

      const page2 = paginateTimelineTasks(sample, 2, 10);
      expect(page2).toHaveLength(10);
      expect(page2[0].id).toBe(11);
      expect(page2[9].id).toBe(20);

      const page3 = paginateTimelineTasks(sample, 3, 10);
      expect(page3).toHaveLength(5);
      expect(page3[0].id).toBe(21);
      expect(page3[4].id).toBe(25);
    });

    it('returns full array when pageSize <= 0', () => {
      expect(paginateTimelineTasks(sample, 1, 0)).toEqual(sample);
    });
  });

  describe('TIMELINE_PAGE_SIZE_OPTIONS', () => {
    it('provides standard page size options', () => {
      expect(TIMELINE_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
    });
  });
});

