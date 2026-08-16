'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, Mail, Bell, CalendarDays, MessageSquareText, Users, FolderKanban } from 'lucide-react';
import { toast } from '@/components/ui';
import * as notificationPreferencesApi from '@/services/notification-preferences-service';
import type { NotificationChannel, NotificationPreferenceRow } from '@/services/notification-preferences-service';

type EventTypeOption = {
  value: string;
  label: string;
  description: string;
  icon: ReactNode;
};

const EVENT_TYPES: EventTypeOption[] = [
  {
    value: 'CHAT_ACTIVITY',
    label: 'Chat activity',
    description: 'Direct messages, mentions, replies, and reactions.',
    icon: <MessageSquareText size={14} />,
  },
  {
    value: 'TASK_ACTIVITY',
    label: 'Task activity',
    description: 'Task assignments, changes, and board updates.',
    icon: <FolderKanban size={14} />,
  },
  {
    value: 'PROJECT_ACTIVITY',
    label: 'Project activity',
    description: 'Project page and workspace-level updates.',
    icon: <Bell size={14} />,
  },
  {
    value: 'TEAM_ACTIVITY',
    label: 'Team activity',
    description: 'Invites, role changes, and membership updates.',
    icon: <Users size={14} />,
  },
  {
    value: 'REMINDER_ACTIVITY',
    label: 'Reminders',
    description: 'Due-date and overdue reminders.',
    icon: <CalendarDays size={14} />,
  },
];

const CHANNELS: Array<{ value: NotificationChannel; label: string; description: string; icon: ReactNode }> = [
  {
    value: 'IN_APP',
    label: 'In-app',
    description: 'Show a bell badge and notification feed entry.',
    icon: <Bell size={14} />,
  },
  {
    value: 'EMAIL',
    label: 'Email',
    description: 'Send an email when the event occurs.',
    icon: <Mail size={14} />,
  },
];

type NotificationPreferencesPanelProps = {
  title: string;
  description: string;
  projectId?: number;
  helperText?: string;
};

function preferenceKey(eventType: string, channel: NotificationChannel): string {
  return `${eventType}:${channel}`;
}

function buildPreferenceMap(rows: NotificationPreferenceRow[]): Record<string, boolean> {
  return rows.reduce<Record<string, boolean>>((acc, row) => {
    acc[preferenceKey(row.eventType, row.channel)] = row.enabled;
    return acc;
  }, {});
}

function ToggleCell({
  enabled,
  busy,
  label,
  onClick,
}: {
  enabled: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={[
        'inline-flex h-10 w-full items-center justify-between rounded-xl border px-3.5 py-2 transition-colors',
        enabled ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500',
        busy ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <span className="text-sm font-semibold">{enabled ? 'On' : 'Off'}</span>
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
    </button>
  );
}

export default function NotificationPreferencesPanel({
  title,
  description,
  projectId,
  helperText,
}: NotificationPreferencesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [preferenceMap, setPreferenceMap] = useState<Record<string, boolean>>({});

  const scopeLabel = projectId == null ? 'Global defaults' : 'Project override';

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const rows = await notificationPreferencesApi.fetchNotificationPreferences(projectId);
      setPreferenceMap(buildPreferenceMap(rows));
    } catch {
      toast('Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void loadPreferences());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const matrix = useMemo(() => EVENT_TYPES, []);

  const handleToggle = async (eventType: string, channel: NotificationChannel) => {
    const key = preferenceKey(eventType, channel);
    const nextEnabled = !(preferenceMap[key] ?? true);

    setSavingKey(key);
    setPreferenceMap((prev) => ({ ...prev, [key]: nextEnabled }));

    try {
      await notificationPreferencesApi.updateNotificationPreference({
        projectId: projectId ?? null,
        eventType,
        channel,
        enabled: nextEnabled,
      });
      toast('Notification preference updated', 'success');
    } catch {
      setPreferenceMap((prev) => ({ ...prev, [key]: !nextEnabled }));
      toast('Failed to update notification preference', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 sm:px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Bell size={14} />
              Notification Settings
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">{description}</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {scopeLabel}
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-4">
        {helperText ? <p className="text-sm text-slate-500">{helperText}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))] gap-px bg-slate-200 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <div className="bg-slate-50 px-4 py-3">Event type</div>
            {CHANNELS.map((channel) => (
              <div key={channel.value} className="bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-slate-700 normal-case tracking-normal">
                  {channel.icon}
                  {channel.label}
                </div>
                <p className="mt-1 text-[11px] font-normal uppercase tracking-[0.16em] text-slate-400">
                  {channel.description}
                </p>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="bg-white px-4 py-10 flex items-center justify-center text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              Loading notification preferences…
            </div>
          ) : (
            <div className="divide-y divide-slate-200 bg-slate-50">
              {matrix.map((eventType) => (
                <div
                  key={eventType.value}
                  className="grid grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))] gap-px bg-slate-200"
                >
                  <div className="bg-white px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                        {eventType.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{eventType.label}</p>
                        <p className="mt-1 text-sm text-slate-500">{eventType.description}</p>
                      </div>
                    </div>
                  </div>

                  {CHANNELS.map((channel) => {
                    const key = preferenceKey(eventType.value, channel.value);
                    const enabled = preferenceMap[key] ?? true;
                    const busy = savingKey === key;
                    return (
                      <div key={channel.value} className="bg-white px-4 py-4 flex items-center">
                        <ToggleCell
                          enabled={enabled}
                          busy={busy}
                          label={`${eventType.label} ${channel.label}`}
                          onClick={() => void handleToggle(eventType.value, channel.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
