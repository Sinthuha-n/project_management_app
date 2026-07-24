'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs refresh work only while the application is visible. This avoids polling
 * in background tabs and performs a single catch-up refresh when the user
 * returns, without changing any route-specific data semantics.
 */
export function useVisibilityInterval(callback: () => void, delayMs: number, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || delayMs <= 0) return;

    const run = () => {
      if (document.visibilityState === 'visible') callbackRef.current();
    };
    const handleVisibilityChange = () => run();
    const intervalId = window.setInterval(run, delayMs);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [delayMs, enabled]);
}
