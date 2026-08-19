'use client';

import { useState, useMemo, useCallback } from 'react';
import { Task, KanbanColumn as KanbanColumnType, KanbanColumnConfig, DateFilter } from '../types';
import type { TeamMemberOption } from '../api';

export function matchesTaskAssignees(
  task: Task,
  selectedAssignees: string[],
  teamMembers: TeamMemberOption[] = []
): boolean {
  if (selectedAssignees.length === 0) return true;

  const memberLookup = new Map<string, TeamMemberOption>();
  for (const m of teamMembers) {
    if (m.name) memberLookup.set(m.name.toLowerCase(), m);
    if (m.id != null) memberLookup.set(String(m.id), m);
    if (m.userId != null) memberLookup.set(String(m.userId), m);
    if (m.memberId != null) memberLookup.set(String(m.memberId), m);
  }

  const taskAssigneeNames: string[] = [];
  const taskAssigneeIds = new Set<number>();

  if (task.assigneeName && task.assigneeName !== 'Unassigned') {
    taskAssigneeNames.push(task.assigneeName.toLowerCase());
  }
  if (task.assignee?.name && task.assignee.name !== 'Unassigned') {
    taskAssigneeNames.push(task.assignee.name.toLowerCase());
  }
  if (task.assigneeId != null) taskAssigneeIds.add(task.assigneeId);
  if (task.assignee?.id != null) taskAssigneeIds.add(task.assignee.id);
  if (task.assignee?.userId != null) taskAssigneeIds.add(task.assignee.userId);
  if (task.assignee?.memberId != null) taskAssigneeIds.add(task.assignee.memberId);

  if (Array.isArray(task.assigneeIds)) {
    task.assigneeIds.forEach((id) => {
      if (id != null) taskAssigneeIds.add(id);
    });
  }

  if (Array.isArray(task.assignees)) {
    task.assignees.forEach((a) => {
      if (a.name && a.name !== 'Unassigned') {
        taskAssigneeNames.push(a.name.toLowerCase());
      }
      if (a.id != null) taskAssigneeIds.add(a.id);
      if (a.userId != null) taskAssigneeIds.add(a.userId);
      if (a.memberId != null) taskAssigneeIds.add(a.memberId);
    });
  }

  const isUnassigned = taskAssigneeNames.length === 0 && taskAssigneeIds.size === 0;

  return selectedAssignees.some((selected) => {
    if (selected === 'Unassigned') {
      return isUnassigned;
    }
    const selLower = selected.toLowerCase();

    // 1. Direct name match (case-insensitive)
    if (taskAssigneeNames.includes(selLower)) return true;

    // 2. Check if selected matches a team member, then check IDs or names of that member
    const member = memberLookup.get(selLower) || memberLookup.get(selected);
    if (member) {
      if (member.id != null && taskAssigneeIds.has(member.id)) return true;
      if (member.userId != null && taskAssigneeIds.has(member.userId)) return true;
      if (member.memberId != null && taskAssigneeIds.has(member.memberId)) return true;
      if (member.name && taskAssigneeNames.includes(member.name.toLowerCase())) return true;
    }

    // 3. Check if selected is numeric ID
    const numericId = Number(selected);
    if (!Number.isNaN(numericId) && taskAssigneeIds.has(numericId)) {
      return true;
    }

    // 4. Fuzzy / substring / word match (e.g. username vs full name)
    return taskAssigneeNames.some(
      (name) => name === selLower || name.includes(selLower) || selLower.includes(name)
    );
  });
}

export function useKanbanFilters(
  tasks: Task[],
  columnConfigs: KanbanColumnConfig[],
  teamMembers: TeamMemberOption[] = []
) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterLabel, setFilterLabel] = useState<number | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<DateFilter>({ startDate: null, endDate: null });

  const filterAssignee = filterAssignees.length === 1 ? filterAssignees[0] : '';
  const setFilterAssignee = useCallback((name: string) => {
    setFilterAssignees(name ? [name] : []);
  }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(lower));
    }

    if (filterPriority.length > 0) {
      result = result.filter(t => t.priority && filterPriority.includes(t.priority));
    }

    if (filterAssignees.length > 0) {
      result = result.filter(t => matchesTaskAssignees(t, filterAssignees, teamMembers));
    }

    if (filterLabel !== null) {
      result = result.filter(t =>
        t.labelId === filterLabel || t.labels?.some(l => l.id === filterLabel)
      );
    }

    if (filterDateRange.startDate || filterDateRange.endDate) {
      result = result.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        if (filterDateRange.startDate && due < filterDateRange.startDate) return false;
        if (filterDateRange.endDate && due > filterDateRange.endDate) return false;
        return true;
      });
    }

    return result;
  }, [tasks, searchTerm, filterPriority, filterAssignees, filterLabel, filterDateRange, teamMembers]);

  const columns = useMemo<KanbanColumnType[]>(() => {
    return columnConfigs.map(cfg => {
      // Deduplicate: ensure no two tasks share the same id within a column
      const columnTasks = filteredTasks.filter(t => t.status === cfg.status);
      const seen = new Set<number>();
      const uniqueTasks = columnTasks.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      return {
        status: cfg.status,
        title: cfg.title,
        tasks: uniqueTasks,
      };
    });
  }, [columnConfigs, filteredTasks]);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    filterPriority.length > 0 ||
    filterAssignees.length > 0 ||
    filterLabel !== null ||
    filterDateRange.startDate !== null ||
    filterDateRange.endDate !== null;

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterPriority([]);
    setFilterAssignees([]);
    setFilterLabel(null);
    setFilterDateRange({ startDate: null, endDate: null });
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filterPriority,
    setFilterPriority,
    filterAssignees,
    setFilterAssignees,
    filterAssignee,
    setFilterAssignee,
    filterLabel,
    setFilterLabel,
    filterDateRange,
    setFilterDateRange,
    clearFilters,
    hasActiveFilters,
    filteredTasks,
    columns,
  };
}
