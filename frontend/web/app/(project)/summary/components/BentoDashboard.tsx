'use client';

import React, { useMemo } from 'react';
import { Task, Sprint, ProjectMetrics, PageItem, MilestoneResponse } from '@/types';

// Legacy layer for React-Grid-Layout v1 compatibility
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WidthProvider, Responsive } = require('react-grid-layout/legacy') as typeof import('react-grid-layout/legacy');
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Core UI and Configurations
import { BentoCard } from './BentoCard';
import { SummaryIcons as Icons } from './SummaryIcons';
import { buildDefaultLayouts, Layouts, WidgetLayout } from './layoutConfig';
import { useBentoLayout } from '../hooks/useBentoLayout';

// Grouped Widget Imports
import { OverallProgress } from './metrics/OverallProgress';
import { StatMetric } from './metrics/StatMetric';

import { BurndownChart } from './charts/BurndownChart';
import { PriorityChart } from './charts/PriorityChart';
import { VelocityChart } from './charts/VelocityChart';
import { LeadTimeChart } from './charts/LeadTimeChart';

import { ActivityFeed } from './activity/ActivityFeed';
import { RecentlyCompleted } from './activity/RecentlyCompleted';
import { DueTasks } from './activity/DueTasks';

import { CurrentSprint } from './planning/CurrentSprint';
import { UpcomingMilestones } from './planning/UpcomingMilestones';

import { ProjectDocs } from './management/ProjectDocs';
import { ProjectChat } from './management/ProjectChat';
import { ProjectNote } from './management/ProjectNote';
import { GenerateReport } from './management/GenerateReport';

import { WorkloadDistribution } from './workload/WorkloadDistribution';

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Main Summary Dashboard that organizes widgets into a responsive Bento grid.
 */
export default function BentoDashboard({
  projectId, tasks, sprints, metrics, projectDetails, pages = [], milestones = [], isAgile,
}: {
  projectId: number; tasks: Task[]; sprints: Sprint[]; metrics: ProjectMetrics;
  projectDetails: { description?: string } | null;
  pages?: PageItem[];
  milestones?: MilestoneResponse[];
  members?: unknown[];
  isAgile: boolean;
}) {
  // Initialize layout state
  const defaultLayouts = useMemo(() => buildDefaultLayouts(isAgile), [isAgile]);
  const { layouts, onLayoutChange, resetLayouts, isHydrated } = useBentoLayout(projectId, defaultLayouts);

  // Define which widgets are active for this project type
  const activeIds = useMemo(() => {
    const base = ['metric-progress', 'metric-total', 'metric-completed', 'metric-due', 'task-dist', 'activity-feed', 'report', 'recently-completed', 'due-tasks', 'milestones', 'docs', 'chat', 'notes'];
    if (isAgile) base.push('sprint', 'burndown', 'velocity', 'lead-time');
    return new Set(base);
  }, [isAgile]);

  // Filter grid items
  const filteredLayouts = useMemo<Layouts>(() => {
    const filtered: Layouts = {};
    Object.entries(layouts || {}).forEach(([bp, items]) => {
      filtered[bp] = (items as WidgetLayout[]).filter(item => activeIds.has(item.i));
    });
    return filtered;
  }, [layouts, activeIds]);

  if (!isHydrated) return null;

  return (
    <div className="w-full pt-4">
      <ResponsiveGridLayout
        className="bento-grid"
        layouts={filteredLayouts}
        breakpoints={{ lg: 1200, md: 768, sm: 0 }}
        cols={{ lg: 24, md: 12, sm: 4 }}
        rowHeight={64}
        margin={[16, 16]}
        draggableHandle=".bento-drag-handle"
        draggableCancel=".bento-no-drag"
        onLayoutChange={onLayoutChange}
        compactType="vertical"
        useCSSTransforms
        resizeHandles={['se']}
      >
        {/* Metric Widgets */}
        <div key="metric-progress">
          <BentoCard title="Overall Progress" icon={Icons.progress}>
            <OverallProgress completedTasks={metrics?.completedTasks || 0} totalTasks={metrics?.totalTasks || 0} />
          </BentoCard>
        </div>

        <div key="metric-total">
          <BentoCard title="Total Tasks" icon={Icons.tasks}>
            <StatMetric iconBg="bg-cu-primary/10 text-cu-primary" icon={Icons.tasks} value={metrics?.totalTasks || 0} label="Total Tasks" />
          </BentoCard>
        </div>

        <div key="metric-completed">
          <BentoCard title="Completed Tasks" icon={Icons.completed}>
            <StatMetric iconBg="bg-cu-success/10 text-cu-success" icon={Icons.completed} value={metrics?.completedTasks || 0} label="Completed Tasks" />
          </BentoCard>
        </div>

        <div key="metric-due">
          <BentoCard title="Due Issues" icon={Icons.due}>
            <StatMetric iconBg="bg-cu-warning/10 text-cu-warning" icon={Icons.due} value={metrics?.overdueTasks || 0} label="Due Issues" />
          </BentoCard>
        </div>

        {/* Chart Widgets */}
        {isAgile && (
          <div key="sprint">
            <BentoCard title="Current Sprint" icon={Icons.sprint} noPadding bodyClassName="p-4 flex flex-col">
              <CurrentSprint projectId={projectId} sprints={sprints} tasks={tasks} />
            </BentoCard>
          </div>
        )}

        {isAgile && (
          <div key="burndown">
            <BentoCard title="Sprint Burndown" icon={Icons.burndown} noPadding bodyClassName="p-4 flex flex-col">
              <BurndownChart tasks={tasks} sprints={sprints} />
            </BentoCard>
          </div>
        )}

        <div key="task-dist">
          <BentoCard title="Task Priority" icon={Icons.chart} noPadding bodyClassName="p-4 flex flex-col">
            <PriorityChart tasks={tasks} />
          </BentoCard>
        </div>

        {isAgile && (
          <div key="velocity">
            <BentoCard title="Velocity" icon={Icons.velocity} noPadding bodyClassName="p-4 flex flex-col">
              <VelocityChart tasks={tasks} sprints={sprints} />
            </BentoCard>
          </div>
        )}

        {isAgile && (
          <div key="lead-time">
            <BentoCard title="Lead Time" icon={Icons.clock} noPadding bodyClassName="p-4 flex flex-col">
              <LeadTimeChart tasks={tasks} />
            </BentoCard>
          </div>
        )}

        {/* Activity Feed and Tracking */}
        <div key="activity-feed">
          <BentoCard title="Recent Activity" icon={Icons.activity} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <ActivityFeed tasks={tasks} />
          </BentoCard>
        </div>

        <div key="report" className="bento-drag-handle rounded-xl overflow-hidden shadow-cu-sm ring-1 ring-cu-border-light/60 border border-cu-border">
          <GenerateReport projectId={projectId} isAgile={isAgile} />
        </div>

        <div key="recently-completed">
          <BentoCard title="Recently Completed" icon={Icons.trophy} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <RecentlyCompleted tasks={tasks} />
          </BentoCard>
        </div>

        <div key="due-tasks">
          <BentoCard title="Due in 5 Days" icon={Icons.clock} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <DueTasks tasks={tasks} />
          </BentoCard>
        </div>

        <div key="milestones">
          <BentoCard title="Upcoming Milestones" icon={Icons.milestone} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <UpcomingMilestones projectId={projectId} milestones={milestones} isLoading={false} />
          </BentoCard>
        </div>

        <div key="docs">
          <BentoCard title="Project Docs" icon={Icons.docs} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <ProjectDocs projectId={projectId} pages={pages} isLoading={false} />
          </BentoCard>
        </div>

        {/* Management and Collaboration */}
        <div key="chat">
          <BentoCard title="Project Chat" icon={Icons.chat} noPadding>
            <ProjectChat projectId={projectId} />
          </BentoCard>
        </div>

        <div key="notes">
          <BentoCard title="Project Notes" icon={Icons.notes} noPadding>
            <ProjectNote projectId={projectId} defaultNote={projectDetails?.description} />
          </BentoCard>
        </div>
      </ResponsiveGridLayout>

      {/* Standalone Workload Distribution */}
      <div className="mt-6">
        <WorkloadDistribution projectId={projectId} tasks={tasks} />
      </div>

      <button
        onClick={resetLayouts}
        title="Reset layout to default"
        className="hidden md:flex fixed bottom-6 right-6 z-50 h-[44px] px-5 flex-row items-center justify-center gap-2 bg-cu-text-primary shadow-cu-lg rounded-full font-semibold text-[13px] text-cu-bg hover:opacity-90 transition-all border border-cu-border"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
        </svg>
        Reset Layout
      </button>
    </div>
  );
}
