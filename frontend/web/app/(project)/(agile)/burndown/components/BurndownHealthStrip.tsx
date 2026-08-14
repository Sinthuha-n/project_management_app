'use client';

import { CalendarClock, Flame, Gauge, Target, TrendingDown } from 'lucide-react';
import type { BurndownSummary } from '@/types';

interface BurndownHealthStripProps {
  summary: BurndownSummary;
}

const HEALTH_STYLE: Record<string, string> = {
  COMPLETE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  ON_TRACK: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  AT_RISK: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  OFF_TRACK: 'bg-red-500/10 text-red-600 border-red-500/20',
  NO_SCOPE: 'bg-cu-bg-tertiary text-cu-text-secondary border-cu-border',
};

const HEALTH_LABEL: Record<string, string> = {
  COMPLETE: 'Complete',
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  OFF_TRACK: 'Off track',
  NO_SCOPE: 'No scope',
};

export { HEALTH_LABEL, HEALTH_STYLE };

export default function BurndownHealthStrip({ summary }: BurndownHealthStripProps) {
  const metrics = [
    { label: 'Progress', value: `${summary.progressPercent}%`, detail: `${summary.completedStoryPoints}/${summary.totalStoryPoints} pts`, icon: Gauge },
    { label: 'Remaining', value: summary.remainingStoryPoints, detail: `${summary.remainingTasks} tasks`, icon: Target },
    { label: 'Projected', value: formatDate(summary.projectedCompletionDate), detail: `${summary.daysRemaining} days left`, icon: CalendarClock },
    { label: 'Actual burn', value: `${summary.actualBurnRate.toFixed(1)}`, detail: 'pts/day', icon: TrendingDown },
    { label: 'Required burn', value: `${summary.requiredBurnRate.toFixed(1)}`, detail: 'pts/day', icon: Flame },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <div className={`flex min-h-[92px] flex-col justify-between rounded-lg border px-4 py-3 ${HEALTH_STYLE[summary.healthStatus] ?? HEALTH_STYLE.NO_SCOPE}`}>
        <p className="text-[11px] font-bold uppercase tracking-wide">Sprint Health</p>
        <p className="text-[22px] font-bold leading-tight">{HEALTH_LABEL[summary.healthStatus] ?? summary.healthStatus}</p>
        <p className="text-[11px] font-medium opacity-80">{summary.completedTasks}/{summary.totalTasks} tasks complete</p>
      </div>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="min-h-[92px] rounded-lg border border-cu-border bg-cu-bg px-4 py-3 shadow-cu-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-cu-text-muted">{metric.label}</p>
              <Icon size={15} className="text-cu-text-muted" />
            </div>
            <p className="mt-2 text-[22px] font-bold leading-tight text-cu-text-primary">{metric.value}</p>
            <p className="text-[11px] text-cu-text-secondary">{metric.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'No trend';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
