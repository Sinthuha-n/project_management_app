'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BurndownPoint {
  date: string;
  remainingPoints: number;
  idealPoints: number;
  completedPoints?: number;
  dailyBurn?: number;
  variancePoints?: number;
  isToday?: boolean;
}

interface BurndownChartProps {
  sprintName: string;
  dataPoints: BurndownPoint[];
  totalStoryPoints: number;
}

export default function BurndownChart({ sprintName, dataPoints, totalStoryPoints }: BurndownChartProps) {
  if (!dataPoints.length) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-lg bg-cu-bg-secondary text-[13px] text-cu-text-muted">
        No data available for this sprint.
      </div>
    );
  }

  const todayPoint = dataPoints.find((point) => point.isToday);
  const maxY = Math.max(totalStoryPoints, ...dataPoints.map((point) => point.remainingPoints), 1);
  const current = dataPoints.find((point) => point.isToday) ?? dataPoints[dataPoints.length - 1];
  const varianceTone = (current.variancePoints ?? 0) > 0 ? 'text-red-500' : (current.variancePoints ?? 0) < 0 ? 'text-emerald-500' : 'text-cu-text-secondary';

  return (
    <section className="rounded-lg border border-cu-border bg-cu-bg p-4 shadow-cu-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-cu-text-muted">Burndown trajectory</p>
          <h2 className="truncate text-[16px] font-bold text-cu-text-primary">{sprintName}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-cu-text-secondary">
          <LegendSwatch className="bg-cu-primary" label="Actual remaining" />
          <LegendSwatch className="border border-dashed border-cu-text-muted" label="Ideal" />
          <span className={varianceTone}>Variance {signed(current.variancePoints ?? 0)} pts</span>
        </div>
      </div>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dataPoints} margin={{ top: 12, right: 18, bottom: 8, left: -14 }}>
            <CartesianGrid stroke="var(--cu-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              minTickGap={18}
              tickFormatter={formatTick}
              tick={{ fontSize: 11, fill: 'var(--cu-text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, Math.ceil(maxY * 1.1)]}
              tick={{ fontSize: 11, fill: 'var(--cu-text-muted)' }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--cu-primary)', strokeDasharray: '3 3' }} />
            {todayPoint && (
              <ReferenceLine
                x={todayPoint.date}
                stroke="var(--cu-primary)"
                strokeDasharray="4 4"
                label={{ value: 'Today', fill: 'var(--cu-primary)', fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Line
              type="linear"
              dataKey="idealPoints"
              name="Ideal"
              stroke="var(--cu-text-muted)"
              strokeWidth={2}
              strokeDasharray="6 5"
              dot={false}
              activeDot={false}
            />
            <Line
              type="stepAfter"
              dataKey="remainingPoints"
              name="Actual"
              stroke="var(--cu-primary)"
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2, fill: 'var(--cu-bg)', stroke: 'var(--cu-primary)' }}
              activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--cu-primary)', stroke: 'var(--cu-bg)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: BurndownPoint }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const variance = point.variancePoints ?? point.remainingPoints - point.idealPoints;
  return (
    <div className="min-w-[190px] rounded-lg border border-cu-border bg-cu-bg px-3 py-2.5 shadow-cu-lg">
      <p className="mb-2 text-[12px] font-bold text-cu-text-primary">{formatFullDate(String(label))}</p>
      <TooltipRow label="Remaining" value={`${point.remainingPoints} pts`} strong />
      <TooltipRow label="Ideal" value={`${point.idealPoints} pts`} />
      <TooltipRow label="Completed" value={`${point.completedPoints ?? 0} pts`} />
      <TooltipRow label="Daily burn" value={`${point.dailyBurn ?? 0} pts`} />
      <TooltipRow label="Variance" value={`${signed(variance)} pts`} tone={variance > 0 ? 'bad' : variance < 0 ? 'good' : 'neutral'} />
    </div>
  );
}

function TooltipRow({ label, value, strong, tone = 'neutral' }: { label: string; value: string; strong?: boolean; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-red-500' : strong ? 'text-cu-primary' : 'text-cu-text-secondary';
  return (
    <div className="flex items-center justify-between gap-4 text-[12px]">
      <span className="text-cu-text-muted">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-0.5 w-5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function formatTick(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function signed(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}
