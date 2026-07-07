import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import React from 'react';

export const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  TODO:        { label: 'To Do',       badge: 'bg-gray-100 text-gray-600' },
  IN_PROGRESS: { label: 'In Progress', badge: 'bg-blue-50 text-blue-700' },
  IN_REVIEW:   { label: 'In Review',   badge: 'bg-amber-50 text-amber-700' },
  DONE:        { label: 'Done',        badge: 'bg-green-50 text-green-700' },
};

export const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  URGENT: { color: '#EF4444', icon: ArrowUp,    label: 'Urgent' },
  HIGH:   { color: '#F97316', icon: ArrowUp,    label: 'High'   },
  MEDIUM: { color: '#F59E0B', icon: ArrowRight, label: 'Medium' },
  LOW:    { color: '#22C55E', icon: ArrowDown,  label: 'Low'    },
};

export const LIST_GRID_CLASS =
  "grid items-center gap-4 px-4 py-2.5 " +
  "grid-cols-[24px_6px_1fr_100px_32px] " + // Mobile default: Checkbox, PriorityBar, Title, Status, Actions
  "sm:grid-cols-[24px_6px_1fr_100px_80px_32px] " + // sm: adds Due (80px)
  "md:grid-cols-[24px_6px_1fr_120px_100px_80px_32px] " + // md: adds Assignees (120px)
  "lg:grid-cols-[24px_6px_75px_1fr_120px_120px_100px_80px_32px] " + // lg: adds Priority (75px), Labels (120px)
  "xl:grid-cols-[24px_6px_75px_1fr_120px_120px_120px_100px_80px_32px]"; // xl: adds Milestones (120px)

