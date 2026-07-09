import type { Task } from '@/types';
import { buildGroupedTasks, formatPriorityLabel, formatStatusLabel } from './list-config';

const tasks = [
  { id: 1, title: 'Design UI', status: 'TODO', priority: 'HIGH', assigneeName: 'Alex' },
  { id: 2, title: 'Ship API', status: 'DONE', priority: 'LOW', assignees: [{ id: 8, name: 'Mina' }] },
  { id: 3, title: 'Triage bugs', status: 'TODO', priority: 'HIGH' },
] as Task[];

describe('list-config helpers', () => {
  it('formats status and priority labels', () => {
    expect(formatStatusLabel('IN_PROGRESS')).toBe('In Progress');
    expect(formatStatusLabel(null)).toBe('To Do');
    expect(formatPriorityLabel('HIGH')).toBe('High');
  });

  it('builds visible grouped task sections', () => {
    const grouped = buildGroupedTasks(tasks, 'status');

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ label: 'To Do' });
    expect(grouped[0].items.map((task) => task.id)).toEqual([1, 3]);
    expect(grouped[1]).toMatchObject({ label: 'Done' });
  });

  it('groups unassigned tasks explicitly', () => {
    const grouped = buildGroupedTasks(tasks, 'assignee');

    expect(grouped.map((group) => group.label)).toEqual(['Alex', 'Mina', 'Unassigned']);
  });
});
