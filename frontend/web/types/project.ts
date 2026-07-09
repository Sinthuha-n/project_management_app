// ── Project Domain Types ───────────────────────────

export type ProjectType = 'AGILE' | 'KANBAN';

export interface Project {
  id: number;
  name: string;
  description?: string;
  projectKey?: string;
  type?: ProjectType;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: number;
  ownerName?: string;
  teamId?: number;
  teamName?: string;
  isFavorite?: boolean;
  favoriteMarkedAt?: string | null;
  lastAccessedAt?: string | null;
}

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  memberCount: number;
  sprintHealth: number;
  activeSprintId: number | null;
}

export interface TeamMemberOption {
  id: number;
  name: string;
  email?: string;
}

export interface TeamMemberInfo {
  id: number;
  user: {
    userId: number;
    fullName: string;
    username: string;
    email?: string;
    profilePicUrl?: string | null;
  };
  role?: string;
}

// ── Sprints ────────────────────────────────────────

export interface Sprint {
  id: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED';
}

export interface SprintItem {
  id: number;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  tasks: import('./task').TaskItem[];
}

// ── Burndown ───────────────────────────────────────

export interface BurndownPoint {
  date: string;
  remainingPoints: number;
  idealPoints: number;
  completedPoints?: number;
  dailyBurn?: number;
  variancePoints?: number;
  isToday?: boolean;
}

export type BurndownHealthStatus = 'COMPLETE' | 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NO_SCOPE';

export interface BurndownSummary {
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  progressPercent: number;
  daysElapsed: number;
  daysRemaining: number;
  idealRemainingPoints: number;
  variancePoints: number;
  actualBurnRate: number;
  requiredBurnRate: number;
  projectedCompletionDate?: string | null;
  healthStatus: BurndownHealthStatus;
}

export interface BurndownBreakdownItem {
  name: string;
  taskCount: number;
  storyPoints: number;
}

export interface BurndownBreakdown {
  byStatus: BurndownBreakdownItem[];
  byPriority: BurndownBreakdownItem[];
}

export interface BurndownResponse {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalStoryPoints: number;
  dataPoints: BurndownPoint[];
  summary?: BurndownSummary;
  breakdown?: BurndownBreakdown;
  insights?: string[];
}

// ── Milestones ─────────────────────────────────────

export interface MilestoneResponse {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  dueDate?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  taskCount: number;
  completedTaskCount: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneRequest {
  name: string;
  description?: string;
  dueDate?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

// ── Kanban / Board ─────────────────────────────────

export interface KanbanColumn {
  status: string;
  title: string;
  tasks: import('./task').Task[];
}

export interface DragItem {
  type: 'task';
  taskId: number;
  columnStatus: string;
}

export interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
}

// ── Views ──────────────────────────────────────────

export type WorkspaceView = 'list' | 'board' | 'calendar' | 'gantt' | 'timeline' | 'table';

// ── Calendar ───────────────────────────────────────

export type CalendarView = 'month' | 'week' | 'agenda';

export interface CalendarEventItem {
  id: string;
  title: string;
  kind: 'sprint' | 'task';
  type?: string;
  status?: string;
  assignee?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  creator?: string;
  description?: string;
  environment?: string;
  hasAttachment?: boolean;
  hasComment?: boolean;
}

export interface CalendarFilters {
  search: string;
  assignees: string[];
  types: string[];
  statuses: string[];
  moreFilters: string[];
}
