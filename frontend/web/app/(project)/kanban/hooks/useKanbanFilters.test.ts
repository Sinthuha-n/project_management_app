import { renderHook, act } from '@testing-library/react';
import { useKanbanFilters, matchesTaskAssignees } from './useKanbanFilters';
import { Task, KanbanColumnConfig } from '../types';
import type { TeamMemberOption } from '../api';

describe('useKanbanFilters - Multi-Assignee Filtering', () => {
  const columnConfigs: KanbanColumnConfig[] = [
    { id: 1, status: 'TODO', title: 'To Do', color: '#64748B', wipLimit: 0 },
    { id: 2, status: 'IN_PROGRESS', title: 'In Progress', color: '#3B82F6', wipLimit: 0 },
    { id: 3, status: 'DONE', title: 'Done', color: '#10B981', wipLimit: 0 },
  ];

  const teamMembers: TeamMemberOption[] = [
    { id: 101, userId: 101, memberId: 1, name: 'Alice Smith' },
    { id: 102, userId: 102, memberId: 2, name: 'Bob Jones' },
    { id: 103, userId: 103, memberId: 3, name: 'Charlie Brown' },
  ];

  const sampleTasks: Task[] = [
    {
      id: 1,
      title: 'Task 1 - Multi Assignee (Alice & Bob)',
      status: 'TODO',
      priority: 'HIGH',
      assigneeId: 101,
      assigneeName: 'Alice Smith',
      assignees: [
        { id: 101, userId: 101, memberId: 1, name: 'Alice Smith' },
        { id: 102, userId: 102, memberId: 2, name: 'Bob Jones' },
      ],
    },
    {
      id: 2,
      title: 'Task 2 - Single Assignee (Bob)',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      assigneeId: 102,
      assigneeName: 'Bob Jones',
      assignees: [
        { id: 102, userId: 102, memberId: 2, name: 'Bob Jones' },
      ],
    },
    {
      id: 3,
      title: 'Task 3 - Multi Assignee (Bob & Charlie)',
      status: 'TODO',
      priority: 'LOW',
      assigneeId: 102,
      assigneeName: 'Bob Jones',
      assignees: [
        { id: 102, userId: 102, memberId: 2, name: 'Bob Jones' },
        { id: 103, userId: 103, memberId: 3, name: 'Charlie Brown' },
      ],
    },
    {
      id: 4,
      title: 'Task 4 - Multi Assignee without primary (Alice & Charlie)',
      status: 'DONE',
      priority: 'URGENT',
      assignees: [
        { id: 101, userId: 101, memberId: 1, name: 'Alice Smith' },
        { id: 103, userId: 103, memberId: 3, name: 'Charlie Brown' },
      ],
    },
    {
      id: 5,
      title: 'Task 5 - Unassigned',
      status: 'TODO',
      priority: 'LOW',
      assignees: [],
    },
  ];

  it('matches secondary assignee on a multi-assignee task when filtered by single person', () => {
    // Bob is secondary on Task 1, primary on Task 2, primary on Task 3
    const { result } = renderHook(() =>
      useKanbanFilters(sampleTasks, columnConfigs, teamMembers)
    );

    act(() => {
      result.current.setFilterAssignee('Bob Jones');
    });

    const taskIds = result.current.filteredTasks.map((t) => t.id);
    expect(taskIds).toContain(1); // Task 1 has Bob as secondary assignee
    expect(taskIds).toContain(2); // Task 2 has Bob as primary assignee
    expect(taskIds).toContain(3); // Task 3 has Bob as primary assignee
    expect(taskIds).not.toContain(4); // Task 4 has Alice and Charlie
    expect(taskIds).not.toContain(5); // Task 5 is unassigned
  });

  it('matches multi-assignee task when filtered by Alice Smith', () => {
    const { result } = renderHook(() =>
      useKanbanFilters(sampleTasks, columnConfigs, teamMembers)
    );

    act(() => {
      result.current.setFilterAssignee('Alice Smith');
    });

    const taskIds = result.current.filteredTasks.map((t) => t.id);
    expect(taskIds).toEqual([1, 4]); // Task 1 (primary) and Task 4 (multi without primary)
  });

  it('matches multi-assignee task when filtering by Charlie Brown', () => {
    const { result } = renderHook(() =>
      useKanbanFilters(sampleTasks, columnConfigs, teamMembers)
    );

    act(() => {
      result.current.setFilterAssignee('Charlie Brown');
    });

    const taskIds = result.current.filteredTasks.map((t) => t.id);
    expect(taskIds).toEqual([3, 4]);
  });

  it('matches case-insensitively and with partial username / name matches', () => {
    const task: Task = {
      id: 10,
      title: 'Special task',
      status: 'TODO',
      assignees: [
        { id: 101, userId: 101, name: 'Alice Smith' },
      ],
    };

    expect(matchesTaskAssignees(task, ['alice smith'], teamMembers)).toBe(true);
    expect(matchesTaskAssignees(task, ['ALICE'], teamMembers)).toBe(true);
    expect(matchesTaskAssignees(task, ['smith'], teamMembers)).toBe(true);
    expect(matchesTaskAssignees(task, ['101'], teamMembers)).toBe(true);
  });

  it('filters unassigned tasks correctly', () => {
    const { result } = renderHook(() =>
      useKanbanFilters(sampleTasks, columnConfigs, teamMembers)
    );

    act(() => {
      result.current.setFilterAssignee('Unassigned');
    });

    const taskIds = result.current.filteredTasks.map((t) => t.id);
    expect(taskIds).toEqual([5]);
  });

  it('supports multiple selected assignees in filterAssignees', () => {
    const { result } = renderHook(() =>
      useKanbanFilters(sampleTasks, columnConfigs, teamMembers)
    );

    act(() => {
      result.current.setFilterAssignees(['Alice Smith', 'Charlie Brown']);
    });

    // Task 1 (Alice), Task 3 (Charlie), Task 4 (Alice & Charlie)
    const taskIds = result.current.filteredTasks.map((t) => t.id);
    expect(taskIds).toEqual([1, 3, 4]);
  });

  it('properly distributes filtered multi-assignee tasks across columns', () => {
    const { result } = renderHook(() =>
      useKanbanFilters(sampleTasks, columnConfigs, teamMembers)
    );

    act(() => {
      result.current.setFilterAssignee('Alice Smith');
    });

    const todoCol = result.current.columns.find((c) => c.status === 'TODO');
    const doneCol = result.current.columns.find((c) => c.status === 'DONE');
    const inProgressCol = result.current.columns.find((c) => c.status === 'IN_PROGRESS');

    expect(todoCol?.tasks.map((t) => t.id)).toEqual([1]);
    expect(doneCol?.tasks.map((t) => t.id)).toEqual([4]);
    expect(inProgressCol?.tasks.map((t) => t.id)).toEqual([]);
  });
});
