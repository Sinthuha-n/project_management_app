import { Activity, Clock3, ShieldCheck, Users } from 'lucide-react';

interface MembersStatsCardsProps {
  totalMembers: number;
  activeCount: number;
  adminCount: number;
  pendingCount: number;
}

const statItems = [
  {
    label: 'Total Members',
    key: 'totalMembers',
    icon: Users,
    accent: 'bg-cu-primary/10 text-cu-primary ring-cu-primary/15',
  },
  {
    label: 'Active',
    key: 'activeCount',
    icon: Activity,
    accent: 'bg-cu-success-light text-cu-success ring-cu-success/15',
  },
  {
    label: 'Admins',
    key: 'adminCount',
    icon: ShieldCheck,
    accent: 'bg-cu-info-light text-cu-info ring-cu-info/15',
  },
  {
    label: 'Pending',
    key: 'pendingCount',
    icon: Clock3,
    accent: 'bg-cu-warning-light text-cu-warning ring-cu-warning/15',
  },
] as const;

export function MembersStatsCards({
  totalMembers,
  activeCount,
  adminCount,
  pendingCount,
}: MembersStatsCardsProps) {
  const values = { totalMembers, activeCount, adminCount, pendingCount };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className="min-w-0 rounded-cu-lg border border-cu-border bg-cu-bg p-4 shadow-cu-sm transition-colors hover:border-cu-border-light"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase text-cu-text-muted">{item.label}</p>
                <p className="mt-2 text-[26px] font-semibold leading-none text-cu-text-primary">{values[item.key]}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-cu-lg ring-1 ${item.accent}`}>
                <Icon size={19} aria-hidden="true" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
