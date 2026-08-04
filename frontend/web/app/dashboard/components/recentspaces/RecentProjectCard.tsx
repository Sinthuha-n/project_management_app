'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import api from '@/lib/axios';
import { ProjectTypeIcon, isAgileProjectType } from '@/components/shared/ProjectTypeIcon';

// Props for the individual project card
interface RecentProjectCardProps {
    id: string;
    name: string;
    projectKey?: string;
    description?: string;
    iconText?: string;
    type?: string;
    boardCount?: number;
    width?: string;
    isFavorite?: boolean;
    onFavoriteToggle?: (isFavorite: boolean) => void;
    favoriteDisabled?: boolean;
    completedTasks?: number;
    totalTasks?: number;
}

export default function RecentProjectCard({
    id,
    name,
    projectKey,
    type = "Team-managed software",
    width,
    isFavorite: initialIsFavorite = false,
    onFavoriteToggle,
    favoriteDisabled = false,
    completedTasks = 0,
    totalTasks = 0,
}: RecentProjectCardProps) {
    const router = useRouter(); // Helper to change pages
    const [isFavorite, setIsFavorite] = useState(initialIsFavorite); // Local favorite state
    const isAgileProject = isAgileProjectType(type); // Check if project is Agile or Kanban

    // Sync local state when initial prop changes
    useEffect(() => {
        queueMicrotask(() => setIsFavorite(initialIsFavorite));
    }, [initialIsFavorite]);

    // Save or remove project from favorites
    const handleFavoriteClick = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click when clicking the star
        if (favoriteDisabled) return;
        const nextState = !isFavorite;
        setIsFavorite(nextState);
        try {
            await api.post(`/api/projects/${id}/favorite`); // Update database
            window.dispatchEvent(new CustomEvent('planora:favorite-toggled')); // Notify other components
            if (onFavoriteToggle) onFavoriteToggle(nextState);
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
            setIsFavorite(!nextState); // Rollback on error
        }
    };

    // Log the time when project is opened
    const recordProjectAccess = async () => {
        try {
            await api.post(`/api/projects/${id}/access`);
        } catch (error) {
            console.error("Failed to record access:", error);
        }
    };

    // Go to project summary page
    const handleCardClick = async () => {
        await recordProjectAccess();
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        localStorage.setItem('currentProjectName', name);
        router.push(`/summary/${id}`);
    };

    // Go directly to Sprint or Kanban board
    const handleBoardClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await recordProjectAccess();
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        localStorage.setItem('currentProjectName', name);

        if (isAgileProject) {
            router.push(`/sprint-board?projectId=${id}`);
        } else {
            router.push(`/kanban?projectId=${id}`);
        }
    };

    // Subtext showing Key and Type (e.g., PLAN • AGILE)
    const displaySubtext = `${projectKey ? projectKey : name.substring(0, 4)} • ${isAgileProject ? 'Agile' : 'Kanban'}`.toUpperCase();

    const boardButtonTitle = isAgileProject ? 'View Sprint Board' : 'View Kanban Board';
    const boardButtonClassName = isAgileProject
        ? 'w-[32px] h-[32px] flex items-center justify-center bg-violet-500/10 text-violet-500 rounded-lg border border-violet-500/20 shadow-sm transition-all duration-300 hover:bg-violet-500 hover:text-white hover:scale-110'
        : 'w-[32px] h-[32px] flex items-center justify-center bg-cu-success/10 text-cu-success rounded-lg border border-cu-success/20 shadow-sm transition-all duration-300 hover:bg-cu-success hover:text-white hover:scale-110';

    // Go to project members page
    const handleMembersClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await recordProjectAccess();
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        localStorage.setItem('currentProjectName', name);
        router.push(`/members/${id}`);
    };

    // Generate a colorful side stripe based on project name
    const getColorStripe = (str: string) => {
        const colors = [
            '#06B6D4',
            '#3B82F6',
            '#10B981',
            '#EF4444',
            '#F59E0B',
            '#6366F1',
        ];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const stripeColor = getColorStripe(name || id);
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const stripeStyle = {
        '--project-stripe': stripeColor,
        background:
            'linear-gradient(180deg, color-mix(in srgb, var(--project-stripe) 92%, var(--cu-bg)) 0%, color-mix(in srgb, var(--project-stripe) 70%, var(--cu-bg)) 100%)',
        boxShadow: 'inset -1px 0 0 color-mix(in srgb, var(--project-stripe) 34%, transparent)',
    } as CSSProperties;

    return (
        <div
            onClick={handleCardClick}
            className={`group flex flex-row ${width ? width : 'min-w-[260px] max-w-[260px] shrink-0'} h-[160px] bg-cu-bg rounded-2xl shadow-cu-sm border border-cu-border cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-[0_12px_24px_rgba(21,93,252,0.12)] hover:border-cu-primary/40 hover:-translate-y-[3px] active:scale-[0.98] relative`}
        >
            {/* Soft background glow on hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background:
                        'linear-gradient(135deg, transparent 0%, transparent 58%, color-mix(in srgb, var(--project-stripe) 10%, transparent) 100%)',
                } as CSSProperties}
            />

            {/* Vertical color stripe for visual identity */}
            <div
                className="w-[8px] h-full shrink-0 transition-all duration-300 group-hover:w-[12px]"
                style={stripeStyle}
            />

            {/* Content Container */}
            <div className="flex flex-col flex-1 py-4 pr-5 pl-4 relative h-full">
                {/* Header: Key and Favorite Star */}
                <div className="flex justify-between items-start w-full">
                    <span className="font-arimo text-[11px] font-bold text-cu-text-muted tracking-[0.05em] uppercase group-hover:text-cu-primary transition-colors duration-300">
                        {displaySubtext}
                    </span>

                    <button
                        onClick={handleFavoriteClick}
                        disabled={favoriteDisabled}
                        title={favoriteDisabled ? 'Favorites are read-only while offline' : undefined}
                        className={`transition-all duration-300 z-10 p-1.5 -mr-1.5 -mt-1.5 rounded-full hover:bg-cu-warning/10 disabled:cursor-not-allowed disabled:opacity-60 ${isFavorite ? 'text-cu-warning scale-110 shadow-sm' : 'text-cu-border hover:text-cu-warning'}`}
                    >
                        <svg
                            width="16" height="16" viewBox="0 0 24 24"
                            fill={isFavorite ? "currentColor" : "transparent"}
                            stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                </div>

                {/* Project Title */}
                <h3 className="font-arimo text-[15px] leading-[22px] text-cu-text-primary font-bold mt-2 line-clamp-2 group-hover:text-cu-primary transition-colors duration-300 tracking-tight">
                    {name}
                </h3>

                {/* Progress bar — only shown when task data is available */}
                {totalTasks > 0 && (
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-[3px]">
                            <span className="text-[10px] text-cu-text-muted">
                                {completedTasks}/{totalTasks} tasks
                            </span>
                            <span
                                className="text-[10px] font-semibold tabular-nums"
                                style={{ color: pct === 100 ? 'var(--cu-success)' : stripeColor }}
                            >
                                {pct}%
                            </span>
                        </div>
                        <div className="h-[3px] w-full bg-cu-bg-tertiary rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: pct === 100 ? 'var(--cu-success)' : stripeColor,
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Footer: Quick Action Buttons */}
                <div className="mt-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            {/* Open Board Button */}
                            <button
                                onClick={handleBoardClick}
                                title={boardButtonTitle}
                                className={boardButtonClassName}
                            >
                                <ProjectTypeIcon projectType={type} size={14} />
                            </button>

                            {/* Members Button */}
                            <button
                                onClick={handleMembersClick}
                                title="Project Members"
                                className="w-[32px] h-[32px] flex items-center justify-center bg-cu-bg-secondary text-cu-text-muted rounded-lg border border-cu-border transition-all duration-300 hover:bg-cu-primary hover:text-white hover:border-transparent hover:scale-110"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </button>
                        </div>

                        {/* Visual indicator to open the project */}
                        <div className="flex items-center px-2.5 py-1 rounded-md bg-cu-bg-secondary border border-cu-border text-cu-text-secondary group-hover:bg-cu-primary group-hover:text-white group-hover:border-transparent transition-all duration-300 shadow-cu-sm">
                            <span className="font-arimo text-[10px] font-bold tracking-[0.1em] uppercase">
                                OPEN
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
