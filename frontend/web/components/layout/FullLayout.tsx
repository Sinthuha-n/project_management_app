'use client';

// Main wrapper layout that orchestrates the Sidebar and TopBar alongside the main page content area.
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Suspense, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import CommandPalette from '@/components/ui/CommandPalette';
import { useNavigation } from '@/lib/navigation-context';

interface FullLayoutProps {
    children: React.ReactNode;
    showTopBar?: boolean;
}

export default function FullLayout({ children, showTopBar = true }: FullLayoutProps) {
    const pathname = usePathname();
    const { isSidebarOpen } = useNavigation();
    const isChatRoute = pathname?.includes('/chat');
    const isSprintBacklogRoute = pathname?.includes('/sprint-backlog');
    const contentInteractionClass = isSidebarOpen
        ? 'pointer-events-none md:pointer-events-auto'
        : 'pointer-events-auto';
    
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [pathname]);

    return (
        <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-cu-bg relative overscroll-none">
            {/* Ambient liquid background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 dark:from-blue-600/15 dark:to-purple-600/15 blur-[100px] sm:blur-[120px] animate-float-slow" />
                <div className="absolute bottom-[10%] right-[-10%] w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] rounded-full bg-gradient-to-tr from-emerald-500/8 to-teal-500/8 dark:from-emerald-500/10 dark:to-teal-500/10 blur-[80px] sm:blur-[100px] animate-float-delayed" />
                <div className="absolute top-[35%] left-[45%] w-[35vw] h-[35vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-tr from-pink-500/8 to-rose-500/8 dark:from-pink-600/10 dark:to-orange-600/10 blur-[90px] sm:blur-[110px] animate-float-medium" />
            </div>

            <Sidebar />
            <div
                className={`flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden transition-[filter] duration-300 ease-out z-10 ${contentInteractionClass}`}
                style={{ transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)' }}
            >
                <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden main-content-area">
                    {showTopBar && (
                        <div className="shrink-0 transition-opacity duration-200 ease-out">
                            <Suspense fallback={null}>
                                <TopBar />
                            </Suspense>
                        </div>
                    )}
                    <div ref={scrollRef} className={`flex-1 w-full flex flex-col min-h-0 relative ${isChatRoute || isSprintBacklogRoute ? 'overflow-hidden' : 'overflow-y-auto touch-pan-y'}`}>
                        {children}
                    </div>
                </div>
            </div>
            <CommandPalette />
        </div>
    );
}
