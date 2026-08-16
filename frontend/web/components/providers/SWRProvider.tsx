'use client';

import { SWRConfig } from 'swr';
import { shouldRetrySWRRequest } from '@/lib/swr-retry';

// Global SWR defaults applied to every useSWR call in the app.
// Individual call-sites can still override these per-hook.
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Don't refetch when the user switches browser tabs — prevents a burst
        // of parallel API calls every time focus returns to the app.
        revalidateOnFocus: false,
        // Don't refetch on reconnect (handled per-hook where it matters).
        revalidateOnReconnect: false,
        // Deduplicate identical requests within 30 s by default.
        dedupingInterval: 30_000,
        // Retry failed requests at most twice (default is 3) with exponential back-off.
        errorRetryCount: 2,
        // Authentication, authorization, validation, and missing-resource failures are
        // terminal. Retrying them only duplicates browser/backend error noise.
        shouldRetryOnError: shouldRetrySWRRequest,
        // Keep data fresh in the background after 5 minutes.
        refreshInterval: 0,
      }}
    >
      {children}
    </SWRConfig>
  );
}
