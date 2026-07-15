'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { resolveBrowserTimeZone } from '@/lib/date-time';

type TimeZoneContextValue = {
  timeZone: string;
  minuteTick: number;
};

const TimeZoneContext = createContext<TimeZoneContextValue>({ timeZone: 'UTC', minuteTick: 0 });

export default function TimeZoneProvider({ children }: { children: React.ReactNode }) {
  const [timeZone, setTimeZone] = useState('UTC');
  const [minuteTick, setMinuteTick] = useState(0);

  const refreshTimeZone = useCallback(() => setTimeZone(resolveBrowserTimeZone()), []);

  useEffect(() => {
    const initializationTimer = window.setTimeout(refreshTimeZone, 0);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshTimeZone();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(initializationTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshTimeZone]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMinuteTick((value) => value + 1);
    }, 60_000 - (Date.now() % 60_000) + 25);
    return () => window.clearTimeout(timeout);
  }, [minuteTick]);

  const value = useMemo(() => ({ timeZone, minuteTick }), [timeZone, minuteTick]);
  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone() {
  return useContext(TimeZoneContext);
}
