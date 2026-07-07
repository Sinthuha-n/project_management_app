import type { MilestoneResponse, Task } from '@/types';
import {
  buildMilestoneViewModels,
  filterMilestones,
  getMilestoneHealth,
  getMilestoneProgress,
  groupTasksByMilestone,
  sortMilestones,
  type MilestoneFilters,
} from './milestone-utils';

const today = new Date('2026-07-07T00:00:00');

const milestone = (overrides: Partial<MilestoneResponse>): MilestoneResponse => ({
  id: 1,
  projectId: 10,
  name: 'Launch',
  description: 'Public release',
  dueDate: '2026-07-12',
  status: 'OPEN',
  taskCount: 0,
  completedTaskCount: 0,
  progressPercent: 0,
  createdAt: '2026-07-01T00:00:00',
  updatedAt: '2026-07-01T00:00:00',
  ...overrides,
});

const task = (overrides: Partial<Task>): Task => ({
  id: 1,
  title: 'Task',
  status: 'TODO',
  projectId: 10,
  ...overrides,
});

describe('milestone-utils', () => {
  it('groups tasks by milestone id', () => {
    const grouped = groupTasksByMilestone([
      task({ id: 1, milestoneId: 10 }),
      task({ id: 2, milestoneId: 10 }),
      task({ id: 3 }),
    ]);

    expect(grouped[10]).toHaveLength(2);
    expect(grouped[10].map((item) => item.id)).toEqual([1, 2]);
  });

  it('calculates progress from linked tasks before response counts', () => {
    const progress = getMilestoneProgress(
      milestone({ taskCount: 20, completedTaskCount: 1 }),
      [task({ status: 'DONE' }), task({ id: 2, status: 'TODO' })],
    );

    expect(progress).toEqual({
      linkedTasks: 2,
      completedTasks: 1,
      remainingTasks: 1,
      progress: 50,
    });
  });

  it('falls back to milestone response counts when linked tasks are unavailable', () => {
    const progress = getMilestoneProgress(milestone({ taskCount: 4, completedTaskCount: 3 }), []);

    expect(progress.progress).toBe(75);
    expect(progress.linkedTasks).toBe(4);
    expect(progress.remainingTasks).toBe(1);
  });

  it('derives milestone health from status, due date, and progress', () => {
    expect(getMilestoneHealth(milestone({ status: 'COMPLETED' }), 100, today)).toBe('complete');
    expect(getMilestoneHealth(milestone({ status: 'CANCELLED' }), 10, today)).toBe('cancelled');
    expect(getMilestoneHealth(milestone({ dueDate: '2026-07-01' }), 90, today)).toBe('overdue');
    expect(getMilestoneHealth(milestone({ dueDate: '2026-07-10' }), 40, today)).toBe('at-risk');
    expect(getMilestoneHealth(milestone({ dueDate: '2026-08-10' }), 40, today)).toBe('on-track');
  });

  it('builds overdue, due-soon, and no-date view models', () => {
    const models = buildMilestoneViewModels([
      milestone({ id: 1, name: 'Late', dueDate: '2026-07-01' }),
      milestone({ id: 2, name: 'Soon', dueDate: '2026-07-09' }),
      milestone({ id: 3, name: 'Floating', dueDate: undefined }),
    ], [], today);

    expect(models.find((item) => item.name === 'Late')?.isOverdue).toBe(true);
    expect(models.find((item) => item.name === 'Soon')?.isDueSoon).toBe(true);
    expect(models.find((item) => item.name === 'Floating')?.hasNoDate).toBe(true);
  });

  it('filters and sorts milestones', () => {
    const filters: MilestoneFilters = {
      search: 'release',
      status: 'ALL',
      due: 'this-week',
      sort: 'progress',
    };
    const models = buildMilestoneViewModels([
      milestone({ id: 1, name: 'Release A', dueDate: '2026-07-09', taskCount: 4, completedTaskCount: 2 }),
      milestone({ id: 2, name: 'Release B', dueDate: '2026-07-10', taskCount: 4, completedTaskCount: 4 }),
      milestone({ id: 3, name: 'Backlog cleanup', description: 'Maintenance', dueDate: '2026-07-09' }),
    ], [], today);

    expect(sortMilestones(filterMilestones(models, filters), filters.sort).map((item) => item.name)).toEqual([
      'Release B',
      'Release A',
    ]);
  });
});
