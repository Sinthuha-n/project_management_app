'use client';

import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import {
    buildSessionCacheKey,
    getSessionCache,
    setSessionCache,
} from '@/lib/session-cache';
import { useOnlineStatus } from '@/components/pwa/OnlineStatusProvider';
// Removed individual type imports as we now get everything from the unified summary object.
import useSWR from 'swr';
import { isAgileProjectType } from '@/components/shared/ProjectTypeIcon';
import SummaryPageSkeleton from "../components/SummarySkeleton";
import dynamic from 'next/dynamic';
import type { MilestoneResponse, PageItem, ProjectMetrics, Sprint, Task } from '@/types';

// Dynamically load the heavy BentoDashboard component for better initial performance
const BentoDashboard = dynamic(() => import('../components/BentoDashboard'), {
    ssr: false,
    loading: () => <SummaryPageSkeleton />
});

const fetcher = (url: string) => api.get(url).then(res => res.data);
const SUMMARY_CACHE_TTL = 2 * 60_000;

type SummaryData = {
    tasks: Task[];
    sprints: Sprint[];
    metrics: ProjectMetrics;
    projectDetails: ({ description?: string; type?: string } & Record<string, unknown>) | null;
    pages: PageItem[];
    milestones: MilestoneResponse[];
    members: unknown[];
};

/**
 * Main Summary Page component for a specific project.
 * Handles primary data fetching using the Pro-level BFF pattern (Single API call).
 */
export default function SummaryPage() {
    const params = useParams();
    const { isOnline } = useOnlineStatus();
    const projectId = Number(params.projectId);
    const cacheKey = projectId ? buildSessionCacheKey('project_summary', [projectId]) : null;
    const cachedSummary = cacheKey
        ? getSessionCache<SummaryData>(cacheKey, { allowStale: true })
        : { data: null, isStale: false };

    // Fetch ALL dashboard data in a single optimized API call!
    const { data: freshSummaryData, isLoading, error } = useSWR(
        projectId && isOnline ? `/api/projects/${projectId}/dashboard-summary` : null,
        fetcher as (url: string) => Promise<SummaryData>,
        {
            fallbackData: cachedSummary.data ?? undefined,
            revalidateOnFocus: isOnline,
            onSuccess: (fresh) => {
                if (cacheKey) {
                    setSessionCache(cacheKey, fresh, SUMMARY_CACHE_TTL);
                }
            },
        },
    );
    const summaryData = freshSummaryData ?? cachedSummary.data;
    const isOfflineReadOnly = !isOnline && Boolean(summaryData);

    // Determine project style based on its type metadata
    const isAgileProject = isAgileProjectType(summaryData?.projectDetails?.type);

    if (!isOnline && !summaryData) {
        return (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-cu-warning/30 bg-cu-bg p-6 text-center shadow-cu-sm">
                <h2 className="text-lg font-bold text-cu-text-primary">No cached summary available</h2>
                <p className="mt-2 text-sm text-cu-text-secondary">
                    Reconnect once to load this project summary, then Planora can show it here while offline.
                </p>
            </div>
        );
    }

    // Show skeleton loader while the single critical request is loading
    if (isLoading || !summaryData) {
        return <SummaryPageSkeleton />;
    }

    if (error && !summaryData) {
        return (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-cu-danger/20 bg-cu-bg p-6 text-center text-cu-danger shadow-cu-sm">
                Failed to load dashboard data. Please refresh.
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-6">
            {isOfflineReadOnly && (
                <div className="mb-4 rounded-cu-xl border border-cu-warning/30 bg-cu-warning-light px-4 py-3 text-sm text-cu-text-primary shadow-cu-sm">
                    <span className="font-bold">Offline read-only mode.</span>{' '}
                    <span className="text-cu-text-secondary">Showing the last cached project summary until your connection returns.</span>
                </div>
            )}
            <BentoDashboard 
                projectId={projectId}
                tasks={summaryData.tasks}
                sprints={summaryData.sprints}
                metrics={summaryData.metrics}
                projectDetails={summaryData.projectDetails}
                pages={summaryData.pages}
                milestones={summaryData.milestones}
                members={summaryData.members}
                isAgile={isAgileProject}
            />
        </div>
    );
}
