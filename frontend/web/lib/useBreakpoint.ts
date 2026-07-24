'use client';
import { useSyncExternalStore } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Returns responsive helpers derived from the current viewport width.
 * Consistent breakpoints across the entire app — prevents layout jumps
 * caused by each page independently tracking window width.
 */
export function useBreakpoint() {
    const width = useSyncExternalStore(
        (onStoreChange) => {
            const onResize = () => onStoreChange();
            window.addEventListener('resize', onResize, { passive: true });
            return () => window.removeEventListener('resize', onResize);
        },
        () => window.innerWidth,
        // A stable server snapshot prevents hydration mismatches. Layout CSS remains
        // the authority until the browser has supplied its real viewport width.
        () => 1024,
    );

    const isMobile  = width < 768;
    const isTablet  = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    const breakpoint: Breakpoint =
        width < 640  ? 'xs'  :
        width < 768  ? 'sm'  :
        width < 1024 ? 'md'  :
        width < 1280 ? 'lg'  :
        width < 1536 ? 'xl'  : '2xl';

    return { breakpoint, isMobile, isTablet, isDesktop, width };
}
