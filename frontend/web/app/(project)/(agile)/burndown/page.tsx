'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, TrendingDown } from 'lucide-react';
import { sprintsApi } from '@/services/api-contract';
import { toast } from '@/components/ui';
import type { BurndownResponse, BurndownSummary } from '@/types';
import BurndownChart from './components/BurndownChart';
import BurndownCommandBar from './components/BurndownCommandBar';
import BurndownHealthStrip from './components/BurndownHealthStrip';
import BurndownInsightRail from './components/BurndownInsightRail';
import BurndownBreakdownPanel from './components/BurndownBreakdownPanel';
import BurndownState from './components/BurndownState';
import DateSetterPrompt from './components/DateSetterPrompt';
import type { BurndownSprint } from './components/SprintSelector';

function BurndownContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [sprints, setSprints] = useState<BurndownSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [sprintDropOpen, setSprintDropOpen] = useState(false);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [burndown, setBurndown] = useState<BurndownResponse | null>(null);
  const [loadingSprints, setLoadingSprints] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSprintDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId);

  const loadSprints = useCallback(async () => {
    if (!projectId) {
      setError('No project selected.');
      setLoadingSprints(false);
      return;
    }
    setLoadingSprints(true);
    try {
      const list = await sprintsApi.listByProject(projectId);
      setSprints(list);
      setError(null);
      if (list.length > 0) {
        const active = list.find((sprint) => sprint.status === 'ACTIVE') ?? list[0];
        setSelectedSprintId(active.id);
        setFilterFrom(active.startDate || '');
        setFilterTo(active.endDate || '');
      }
    } catch {
      setError('Failed to load sprints.');
    } finally {
      setLoadingSprints(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => void loadSprints());
  }, [loadSprints]);

  const fetchBurndown = useCallback(async () => {
    if (!selectedSprintId) return;
    const currentSprint = sprints.find((sprint) => sprint.id === selectedSprintId);
    if (!currentSprint?.startDate || !currentSprint?.endDate) {
      setBurndown(null);
      return;
    }

    setLoadingChart(true);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const data = await sprintsApi.getBurndown(selectedSprintId, params);
      setBurndown(data);
      setError(null);
    } catch {
      setBurndown(null);
      setError('Failed to load burndown analytics.');
    } finally {
      setLoadingChart(false);
    }
  }, [selectedSprintId, filterFrom, filterTo, sprints]);

  useEffect(() => {
    queueMicrotask(() => void fetchBurndown());
  }, [fetchBurndown]);

  const summary = useMemo(() => {
    if (!burndown) return null;
    return burndown.summary ?? buildFallbackSummary(burndown);
  }, [burndown]);

  const handleSprintSelect = (sprint: BurndownSprint) => {
    setSelectedSprintId(sprint.id);
    setFilterFrom(sprint.startDate || '');
    setFilterTo(sprint.endDate || '');
    setBurndown(null);
    setSprintDropOpen(false);
  };

  const handleResetRange = () => {
    if (!selectedSprint) return;
    setFilterFrom(selectedSprint.startDate || '');
    setFilterTo(selectedSprint.endDate || '');
  };

  const handleDateSaving = async (field: 'start' | 'end', val: string) => {
    if (!selectedSprint) return;
    const normalized = val ? String(val).slice(0, 10) : null;
    try {
      await sprintsApi.update(selectedSprint.id, {
        name: selectedSprint.name,
        startDate: field === 'start' ? normalized : (selectedSprint.startDate || null),
        endDate: field === 'end' ? normalized : (selectedSprint.endDate || null),
      });
      setSprints((prev) => prev.map((sprint) => sprint.id === selectedSprint.id
        ? {
            ...sprint,
            startDate: field === 'start' ? normalized : sprint.startDate,
            endDate: field === 'end' ? normalized : sprint.endDate,
          }
        : sprint
      ));
      if (field === 'start') setFilterFrom(normalized || '');
      if (field === 'end') setFilterTo(normalized || '');
    } catch {
      toast('Failed to save sprint date', 'error');
    }
  };

  return (
    <div className="min-h-full bg-cu-bg-secondary p-4 pb-6 font-[var(--font-inter)] sm:p-5">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cu-primary shadow-cu-sm">
            <TrendingDown size={19} className="text-white" />
          </div>
          <div>
            <h1 className="text-[21px] font-bold leading-tight text-cu-text-primary">Burndown</h1>
            <p className="text-[13px] text-cu-text-secondary">Sprint health, burn rate, forecast, and workload mix</p>
          </div>
        </div>
        {summary && (
          <div className="flex items-center gap-2 rounded-lg border border-cu-border bg-cu-bg px-3 py-2 text-[12px] text-cu-text-secondary shadow-cu-sm">
            <BarChart3 size={15} className="text-cu-primary" />
            {summary.completedStoryPoints}/{summary.totalStoryPoints} points burned
          </div>
        )}
      </header>

      {loadingSprints ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-cu-border bg-cu-bg text-[13px] text-cu-text-secondary shadow-cu-sm">
          Loading sprint analytics...
        </div>
      ) : !projectId ? (
        <BurndownState title="No project selected" message="Open a project before viewing sprint burndown analytics." />
      ) : error && sprints.length === 0 ? (
        <BurndownState title="Could not load sprints" message={error} tone="error" actionLabel="Retry" onAction={loadSprints} />
      ) : sprints.length === 0 ? (
        <BurndownState title="No sprints found" message="Create or start a sprint to generate burndown analytics for this project." />
      ) : (
        <main className="space-y-4">
          <div className="overflow-visible rounded-lg border border-cu-border bg-cu-bg shadow-cu-sm">
            <BurndownCommandBar
              sprints={sprints}
              selectedSprint={selectedSprint}
              selectedSprintId={selectedSprintId}
              sprintDropOpen={sprintDropOpen}
              filterFrom={filterFrom}
              filterTo={filterTo}
              loading={loadingChart}
              dropdownRef={dropdownRef}
              onToggleDropdown={() => setSprintDropOpen((open) => !open)}
              onSelectSprint={handleSprintSelect}
              onFilterFromChange={setFilterFrom}
              onFilterToChange={setFilterTo}
              onResetRange={handleResetRange}
              onRefresh={fetchBurndown}
            />
          </div>

          {selectedSprint && (!selectedSprint.startDate || !selectedSprint.endDate) ? (
            <section className="rounded-lg border border-cu-border bg-cu-bg p-5 shadow-cu-sm">
              <DateSetterPrompt
                startDate={selectedSprint.startDate}
                endDate={selectedSprint.endDate}
                onSaveDate={handleDateSaving}
              />
            </section>
          ) : error && !burndown ? (
            <BurndownState title="Could not load burndown" message={error} tone="error" actionLabel="Retry" onAction={fetchBurndown} />
          ) : loadingChart && !burndown ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-cu-border bg-cu-bg text-[13px] text-cu-text-secondary shadow-cu-sm">
              Loading burndown analytics...
            </div>
          ) : burndown && summary ? (
            <>
              <BurndownHealthStrip summary={summary} />
              {summary.healthStatus === 'NO_SCOPE' && (
                <BurndownState
                  title="No estimated scope"
                  message="This sprint has tasks, but no story points are estimated yet. Add estimates to make burn rate and forecast useful."
                />
              )}
              {summary.totalStoryPoints > 0 && summary.completedStoryPoints === 0 && (
                <BurndownState
                  title="No completed work yet"
                  message="The sprint has estimated scope but no completed story points in the selected date range."
                />
              )}
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <BurndownChart
                  sprintName={burndown.sprintName}
                  dataPoints={burndown.dataPoints}
                  totalStoryPoints={burndown.totalStoryPoints}
                />
                <BurndownInsightRail summary={summary} insights={burndown.insights ?? []} />
              </div>
              <BurndownBreakdownPanel breakdown={burndown.breakdown} />
              <SprintScopeNote burndown={burndown} selectedSprint={selectedSprint} />
            </>
          ) : (
            <BurndownState title="Select a sprint" message="Choose a sprint to view its burndown analytics." />
          )}
        </main>
      )}
    </div>
  );
}

function SprintScopeNote({ burndown, selectedSprint }: { burndown: BurndownResponse; selectedSprint?: BurndownSprint }) {
  return (
    <p className="text-center text-[12px] leading-5 text-cu-text-muted">
      Sprint <strong className="text-cu-text-secondary">{selectedSprint?.name ?? burndown.sprintName}</strong> ·{' '}
      {formatFullDate(burndown.startDate)} to {formatFullDate(burndown.endDate)} · current scope only
    </p>
  );
}

function buildFallbackSummary(burndown: BurndownResponse): BurndownSummary {
  const lastPoint = burndown.dataPoints[burndown.dataPoints.length - 1];
  const remaining = lastPoint?.remainingPoints ?? burndown.totalStoryPoints;
  const completed = Math.max(0, burndown.totalStoryPoints - remaining);
  const ideal = lastPoint?.idealPoints ?? burndown.totalStoryPoints;
  return {
    totalStoryPoints: burndown.totalStoryPoints,
    completedStoryPoints: completed,
    remainingStoryPoints: remaining,
    totalTasks: 0,
    completedTasks: 0,
    remainingTasks: 0,
    progressPercent: burndown.totalStoryPoints > 0 ? Math.round((completed / burndown.totalStoryPoints) * 100) : 0,
    daysElapsed: burndown.dataPoints.length,
    daysRemaining: 0,
    idealRemainingPoints: ideal,
    actualBurnRate: 0,
    requiredBurnRate: 0,
    projectedCompletionDate: null,
    healthStatus: burndown.totalStoryPoints === 0 ? 'NO_SCOPE' : remaining === 0 ? 'COMPLETE' : remaining <= ideal ? 'ON_TRACK' : 'AT_RISK',
  };
}

function formatFullDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BurndownPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-cu-text-secondary">
          Loading...
        </div>
      }
    >
      <BurndownContent />
    </Suspense>
  );
}
