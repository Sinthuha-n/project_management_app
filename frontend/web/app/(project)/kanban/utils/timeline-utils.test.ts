import type { Task } from '../types';
import {
  buildTimelineTasks,
  filterTimelineTasks,
  getTimelineInsights,
  groupTimelineTasks,
  schedulePresetDates,
  type TimelineFilters,
} from './timeline-utils';

const baseFilters: TimelineFilters = {
  search: '',
  assignee: '',
  milestone: '',
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
      scheduled: 2,
      unscheduled: 1,
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
  });

  it('builds timeline models and groups them by status, assignee, and milestone', () => {
    const visibleDays = [
      new Date('2026-07-06T00:00:00'),
      new Date('2026-07-07T00:00:00'),
      new Date('2026-07-08T00:00:00'),
    ];
    const models = buildTimelineTasks(tasks, visibleDays, 38, milestones, null, 0, new Date('2026-07-07T00:00:00'));
    const apiTask = models.find((task) => task.id === 1);

    expect(models).toHaveLength(2);
    expect(apiTask).toMatchObject({ id: 1, leftPx: 0, widthPx: 108, durationDays: 3, isBlocked: true, isPastMilestone: true });
    expect(groupTimelineTasks(models, 'status').map((group) => group.label)).toEqual(expect.arrayContaining(['IN PROGRESS', 'TODO']));
    expect(groupTimelineTasks(models, 'assignee').map((group) => group.label)).toEqual(expect.arrayContaining(['Asha', 'Ben']));
    expect(groupTimelineTasks(models, 'milestone').map((group) => group.label)).toEqual(expect.arrayContaining(['MVP', 'No milestone']));
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
});
