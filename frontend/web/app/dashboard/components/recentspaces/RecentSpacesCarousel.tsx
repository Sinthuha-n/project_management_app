'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import RecentProjectCard from './RecentProjectCard';
import type { ProjectSummary } from './types';

// Props for the carousel (data and loading state)
interface RecentSpacesCarouselProps {
    projects: ProjectSummary[];
    loading: boolean;
    searchQuery: string;
}

export default function RecentSpacesCarousel({ projects, loading, searchQuery }: RecentSpacesCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
    const [showLeftArrow, setShowLeftArrow] = useState(false); // State for left navigation arrow
    const [showRightArrow, setShowRightArrow] = useState(true); // State for right navigation arrow

    // Stable reference so addEventListener/removeEventListener see the same function.
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setShowLeftArrow(scrollLeft > 10);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }, []);

    // Initialize scroll listener and initial check
    useEffect(() => {
        const current = scrollRef.current;
        if (current) {
            current.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll();
            window.addEventListener('resize', handleScroll, { passive: true });
        }
        return () => {
            if (current) {
                current.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('resize', handleScroll);
        };
    }, [projects, handleScroll]);

    // Manual scroll using arrow buttons
    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { clientWidth } = scrollRef.current;
            const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    // Show skeletons while data is being fetched
    if (loading) {
        return (
            <div className="flex gap-4 overflow-hidden py-1 w-full hide-scrollbar">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex flex-col p-5 h-[160px] min-w-[240px] rounded-2xl border border-cu-border bg-cu-bg shadow-cu-sm shrink-0"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-3 items-center">
                                <div className="w-8 h-8 rounded-[4px] bg-cu-bg-tertiary animate-pulse" />
                                <div className="w-20 h-3 bg-cu-bg-tertiary rounded animate-pulse" />
                            </div>
                            <div className="w-4 h-4 bg-cu-bg-tertiary rounded animate-pulse" />
                        </div>
                        <div className="w-2/3 h-5 bg-cu-bg-tertiary rounded animate-pulse mt-2 mb-auto" />
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-cu-border">
                            <div className="w-12 h-3 bg-cu-bg-tertiary rounded animate-pulse" />
                            <div className="w-16 h-3 bg-cu-bg-tertiary rounded animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Show empty state if no projects match filters/search
    if (projects.length === 0) {
        return (
            <div className="w-full py-8 text-center bg-cu-bg-secondary rounded border border-dashed border-cu-border">
                <p className="font-arimo text-[14px] text-cu-text-secondary">
                    {searchQuery ? `No results for "${searchQuery}"` : 'No spaces found for this tab'}
                </p>
            </div>
        );
    }

    return (
        <div className="relative group/carousel w-full mt-1">
            {/* Left arrow button */}
            {showLeftArrow && (
                <button
                    onClick={() => scroll('left')}
                    className="md:flex hidden absolute left-[-12px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-cu-bg border border-cu-border rounded-full shadow-cu-md items-center justify-center text-cu-text-primary hover:bg-cu-hover transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
            )}

            {/* Scrollable card container */}
            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 md:px-0 hide-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', contentVisibility: 'auto', containIntrinsicSize: '0 160px' } as React.CSSProperties}
            >
                <style jsx>{`
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {/* Render up to 5 project cards */}
                {projects.slice(0, 5).map((project) => (
                    <RecentProjectCard
                        key={project.id}
                        id={project.id.toString()}
                        name={project.name}
                        projectKey={project.projectKey}
                        type={project.type}
                        isFavorite={project.isFavorite}
                        width="min-w-[240px] max-w-[240px]"
                        completedTasks={project.completedTasks}
                        totalTasks={project.totalTasks}
                    />
                ))}

                {/* Final "View All" card */}
                <Link
                    href="/spaces"
                    prefetch={false}
                    className="group flex flex-col justify-center items-center min-w-[200px] h-[160px] bg-cu-bg-secondary/50 hover:bg-cu-bg rounded-2xl border border-dashed border-cu-border hover:border-cu-primary/30 hover:shadow-[0_8px_24px_rgba(0,82,204,0.08)] cursor-pointer transition-all duration-300 hover:-translate-y-[2px] shrink-0"
                >
                    <div className="w-10 h-10 rounded-full bg-cu-bg flex items-center justify-center shadow-cu-sm border border-cu-border mb-3 group-hover:bg-cu-primary group-hover:border-transparent transition-all duration-300 group-hover:scale-110">
                        <ArrowRight size={20} strokeWidth={2.5} className="text-cu-primary group-hover:text-white" />
                    </div>
                    <span className="font-arimo text-[15px] font-semibold text-cu-text-secondary group-hover:text-cu-primary transition-colors">View all spaces</span>
                    {projects.length > 5 && (
                        <span className="font-arimo text-[12px] text-cu-text-muted mt-1 font-medium">+{projects.length - 5} more</span>
                    )}
                </Link>
            </div>

            {/* Right arrow button */}
            {showRightArrow && (
                <button
                    onClick={() => scroll('right')}
                    className="md:flex hidden absolute right-[-12px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-cu-bg border border-cu-border rounded-full shadow-cu-md items-center justify-center text-cu-text-primary hover:bg-cu-hover transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label="Scroll right"
                >
                    <ChevronRight size={20} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}


