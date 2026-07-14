"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { TaskActivity } from '@/types';
import { formatRelativeTime } from '@/lib/date-time';
import { useTimeZone } from '@/components/providers/TimeZoneProvider';

interface ActivityFeedProps {
  taskId?: number;
}

// Keyed by activityType string from the API so new event types get a default '•'
// without requiring a code change, and existing ones get a recognisable icon.
const ACTIVITY_ICONS: Record<string, string> = {
  TASK_CREATED:     '✨',
  STATUS_CHANGED:   '🔄',
  PRIORITY_CHANGED: '🔥',
  ASSIGNEE_CHANGED: '👤',
  SUBTASK_ADDED:    '➕',
  SUBTASK_COMPLETED:'✅',
  COMMENT_ADDED:    '💬',
  ATTACHMENT_ADDED: '📎',
  ATTACHMENT_DELETED:'🗑️',
  LABEL_ADDED:      '🏷️',
  LABEL_REMOVED:    '🏷️',
};

const ACTIVITY_COLORS: Record<string, string> = {
  TASK_CREATED:     'bg-cu-primary/10 border-cu-primary/30',
  STATUS_CHANGED:   'bg-violet-500/10 border-violet-500/30',
  PRIORITY_CHANGED: 'bg-cu-warning/10 border-cu-warning/30',
  ASSIGNEE_CHANGED: 'bg-cu-info/10 border-cu-info/30',
  SUBTASK_ADDED:    'bg-cu-success/10 border-cu-success/30',
  SUBTASK_COMPLETED:'bg-cu-success/10 border-cu-success/30',
  COMMENT_ADDED:    'bg-cu-primary/5 border-cu-primary/20',
  ATTACHMENT_ADDED: 'bg-cu-warning/10 border-cu-warning/30',
  ATTACHMENT_DELETED:'bg-cu-danger/10 border-cu-danger/30',
  LABEL_ADDED:      'bg-violet-500/10 border-violet-500/30',
  LABEL_REMOVED:    'bg-violet-500/10 border-violet-500/30',
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ taskId }) => {
  const { minuteTick } = useTimeZone();
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    const load = () => {
      setLoading(true);
      api.get<TaskActivity[]>(`/api/tasks/${taskId}/activities`)
        .then((res) => setActivities(res.data))
        .catch(() => setActivities([]))
        .finally(() => setLoading(false));
    };
    load();
  }, [taskId]);

  if (loading) {
    return (
      <div className="mt-4 text-center py-8 text-cu-text-muted text-sm">Loading activity...</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="mt-4 text-center py-10 bg-cu-bg-secondary rounded-lg border border-dashed border-cu-border">
        <p className="text-cu-text-secondary text-sm font-medium mb-1">No activity yet</p>
        <p className="text-cu-text-muted text-xs">Changes to this task will appear here.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 relative pl-5 border-l-2 border-cu-border space-y-5">
      {activities.map((activity) => {
        const icon = ACTIVITY_ICONS[activity.activityType] ?? '•';
        const colorClass = ACTIVITY_COLORS[activity.activityType] ?? 'bg-cu-bg-secondary border-cu-border';
        return (
          <div key={activity.id} className="relative">
            {/* Timeline dot */}
            <div className={`absolute -left-[23px] w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${colorClass}`}>
              {icon}
            </div>
            <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-semibold text-cu-text-primary">{activity.actorName}</span>
              <span className="text-xs text-cu-text-muted">{formatRelativeTime(activity.createdAt, Date.now() + minuteTick * 0)}</span>
            </div>
            <p className="text-sm text-cu-text-secondary bg-cu-bg-secondary rounded px-3 py-1.5 border border-cu-border">
              {activity.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
