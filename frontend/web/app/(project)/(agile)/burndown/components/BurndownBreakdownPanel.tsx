'use client';

import type { BurndownBreakdown, BurndownBreakdownItem } from '@/types';

interface BurndownBreakdownPanelProps {
  breakdown?: BurndownBreakdown;
}

export default function BurndownBreakdownPanel({ breakdown }: BurndownBreakdownPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BreakdownList title="Status mix" items={breakdown?.byStatus ?? []} />
      <BreakdownList title="Priority mix" items={breakdown?.byPriority ?? []} />
    </div>
  );
}

function BreakdownList({ title, items }: { title: string; items: BurndownBreakdownItem[] }) {
  const maxPoints = Math.max(...items.map((item) => item.storyPoints), 1);
  return (
    <section className="rounded-lg border border-cu-border bg-cu-bg p-4 shadow-cu-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-bold text-cu-text-primary">{title}</h2>
        <span className="text-[11px] font-medium text-cu-text-muted">{items.length} groups</span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                <span className="font-semibold text-cu-text-primary">{labelize(item.name)}</span>
                <span className="text-cu-text-secondary">{item.storyPoints} pts · {item.taskCount} tasks</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cu-bg-secondary">
                <div
                  className="h-full rounded-full bg-cu-primary"
                  style={{ width: `${Math.max(4, (item.storyPoints / maxPoints) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-cu-bg-secondary px-3 py-6 text-center text-[12px] text-cu-text-muted">No breakdown data available.</p>
      )}
    </section>
  );
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
