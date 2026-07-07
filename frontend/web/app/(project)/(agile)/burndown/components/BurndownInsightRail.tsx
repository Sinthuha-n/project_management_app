'use client';

import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import type { BurndownSummary } from '@/types';
import { HEALTH_LABEL, HEALTH_STYLE } from './BurndownHealthStrip';

interface BurndownInsightRailProps {
  summary: BurndownSummary;
  insights: string[];
}

export default function BurndownInsightRail({ summary, insights }: BurndownInsightRailProps) {
  const ToneIcon = summary.healthStatus === 'OFF_TRACK' || summary.healthStatus === 'AT_RISK'
    ? AlertTriangle
    : summary.healthStatus === 'COMPLETE'
      ? CheckCircle2
      : Info;

  return (
    <aside className="flex h-full flex-col gap-4 rounded-lg border border-cu-border bg-cu-bg p-4 shadow-cu-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${HEALTH_STYLE[summary.healthStatus] ?? HEALTH_STYLE.NO_SCOPE}`}>
          <ToneIcon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-wide text-cu-text-muted">Readout</p>
          <h2 className="text-[16px] font-bold text-cu-text-primary">{HEALTH_LABEL[summary.healthStatus] ?? summary.healthStatus}</h2>
          <p className="mt-1 text-[12px] leading-5 text-cu-text-secondary">
            {summary.variancePoints > 0
              ? `${summary.variancePoints} points above the ideal remaining line.`
              : summary.variancePoints < 0
                ? `${Math.abs(summary.variancePoints)} points ahead of the ideal remaining line.`
                : 'Actual burn is aligned with the ideal line.'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {insights.length > 0 ? insights.map((message) => (
          <div key={message} className="flex gap-2 rounded-md bg-cu-bg-secondary px-3 py-2">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-cu-primary" />
            <p className="text-[12px] leading-5 text-cu-text-secondary">{message}</p>
          </div>
        )) : (
          <p className="rounded-md bg-cu-bg-secondary px-3 py-2 text-[12px] text-cu-text-muted">No insights available for this sprint yet.</p>
        )}
      </div>

      <div className="mt-auto rounded-md border border-dashed border-cu-border px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-cu-text-muted">Scope note</p>
        <p className="mt-1 text-[12px] leading-5 text-cu-text-secondary">
          Showing current sprint scope. Exact historical scope changes are unavailable until sprint assignment history is stored.
        </p>
      </div>
    </aside>
  );
}
