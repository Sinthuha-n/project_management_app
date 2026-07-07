'use client';

import { useParams } from 'next/navigation';
import api from '@/lib/axios';
// Removed individual type imports as we now get everything from the unified summary object.
import useSWR from 'swr';
import { isAgileProjectType } from '@/components/shared/ProjectTypeIcon';
import SummaryPageSkeleton from "../components/SummarySkeleton";
import dynamic from 'next/dynamic';

// Dynamically load the heavy BentoDashboard component for better initial performance
const BentoDashboard = dynamic(() => import('../components/BentoDashboard'), {
    ssr: false,
    loading: () => <SummaryPageSkeleton />
});

const fetcher = (url: string) => api.get(url).then(res => res.data);

/**
 * Main Summary Page component for a specific project.
 * Handles primary data fetching using the Pro-level BFF pattern (Single API call).
 */
export default function SummaryPage() {
    const params = useParams();
    const projectId = Number(params.projectId);

    // Fetch ALL dashboard data in a single optimized API call!
    const { data: summaryData, isLoading, error } = useSWR(
        projectId ? `/api/projects/${projectId}/dashboard-summary` : null, 
        fetcher
    );

    // Determine project style based on its type metadata
    const isAgileProject = isAgileProjectType(summaryData?.projectDetails?.type);

    // Show skeleton loader while the single critical request is loading
    if (isLoading || !summaryData) {
        return <SummaryPageSkeleton />;
    }

    if (error) {
        return (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-cu-danger/20 bg-cu-bg p-6 text-center text-cu-danger shadow-cu-sm">
                Failed to load dashboard data. Please refresh.
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-6">
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
