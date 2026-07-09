'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from '@/components/ui/Toast';

type OnlineStatusContextValue = {
  isOnline: boolean;
  isOffline: boolean;
};

const OnlineStatusContext = createContext<OnlineStatusContextValue | undefined>(undefined);

function getInitialOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function OnlineStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const previousOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(getInitialOnlineStatus());
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (previousOnlineRef.current === null) {
      previousOnlineRef.current = isOnline;
      return;
    }

    if (previousOnlineRef.current === isOnline) return;
    previousOnlineRef.current = isOnline;

    if (isOnline) {
      toast.success('Back online. Refreshing workspace data.', 5000);
    } else {
      toast.warning('You are offline. Cached workspace data is read-only.', 8000);
    }
  }, [isOnline]);

  const value = useMemo(
    () => ({
      isOnline,
      isOffline: !isOnline,
    }),
    [isOnline],
  );

  return (
    <OnlineStatusContext.Provider value={value}>
      {children}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-[var(--cu-z-toast)] mx-auto flex max-w-md items-center gap-3 rounded-cu-xl border border-cu-warning/30 bg-cu-warning-light px-4 py-3 text-cu-text-primary shadow-cu-xl sm:inset-x-auto sm:left-4 sm:mx-0"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-cu-lg bg-cu-warning/15 text-cu-warning">
            <WifiOff size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 text-sm">
            <span className="font-bold">Offline mode.</span>{' '}
            <span className="text-cu-text-secondary">Cached data is available read-only until you reconnect.</span>
          </span>
        </div>
      )}
    </OnlineStatusContext.Provider>
  );
}

export function useOnlineStatus(): OnlineStatusContextValue {
  const context = useContext(OnlineStatusContext);
  if (!context) {
    throw new Error('useOnlineStatus must be used within OnlineStatusProvider');
  }
  return context;
}
