'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

type LoadingVariant = 'cards' | 'board' | 'detail' | 'table';

interface RouteLoadingStateProps {
  title: string;
  subtitle?: string;
  variant?: LoadingVariant;
}

interface RouteErrorStateProps {
  title: string;
  subtitle?: string;
  retryLabel?: string;
  onRetry: () => void;
  action?: ReactNode;
}

function LoadingSkeleton({ variant }: { variant: LoadingVariant }) {
  if (variant === 'board') {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, column) => (
          <div key={column} className="rounded-2xl border border-cu-border bg-cu-bg p-4 shadow-cu-sm space-y-3 animate-pulse">
            <div className="h-4 w-20 rounded bg-cu-bg-tertiary" />
            {Array.from({ length: 4 }).map((__, row) => (
              <div key={row} className="h-20 rounded-xl bg-cu-bg-secondary" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-3">
        <div className="h-10 w-full rounded-xl bg-cu-bg-secondary animate-pulse" />
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="h-12 rounded-xl bg-cu-bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border border-cu-border bg-cu-bg p-5 shadow-cu-sm space-y-3 animate-pulse">
          <div className="h-24 rounded-2xl bg-cu-bg-secondary" />
          <div className="h-4 w-28 rounded bg-cu-bg-tertiary" />
          <div className="h-3 w-full rounded bg-cu-bg-secondary" />
          <div className="h-3 w-4/5 rounded bg-cu-bg-secondary" />
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-cu-border bg-cu-bg p-5 shadow-cu-sm space-y-3 animate-pulse">
          <div className="h-5 w-48 rounded bg-cu-bg-tertiary" />
          {Array.from({ length: 4 }).map((_, row) => (
            <div key={row} className="h-12 rounded-xl bg-cu-bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-5 w-44 rounded bg-cu-bg-tertiary animate-pulse" />
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="h-16 rounded-2xl bg-cu-bg-secondary animate-pulse" />
      ))}
    </div>
  );
}

export function RouteLoadingState({ title, subtitle, variant = 'cards' }: RouteLoadingStateProps) {
  return (
    <div className="min-h-[calc(100vh-140px)] bg-cu-bg-secondary px-4 py-6 md:px-6 md:py-8" role="status" aria-live="polite" aria-busy="true" aria-label={title}>
      <div className="mx-auto w-full max-w-[1400px]">
        <span className="sr-only">{title}</span>
        <div className="mb-4 rounded-2xl border border-cu-border bg-cu-bg px-5 py-4 shadow-cu-sm">
          <div className="animate-pulse space-y-2">
            <div className="h-5 w-48 rounded bg-cu-bg-tertiary" />
            {subtitle && <div className="h-3 w-72 rounded bg-cu-bg-secondary" />}
          </div>
        </div>
        <LoadingSkeleton variant={variant} />
      </div>
    </div>
  );
}

export function RouteErrorState({ title, subtitle, retryLabel = 'Try again', onRetry, action }: RouteErrorStateProps) {
  return (
    <div className="min-h-[calc(100vh-140px)] bg-cu-bg-secondary px-4 py-6 md:px-6 md:py-8 flex items-center justify-center" role="alert">
      <div className="w-full max-w-2xl rounded-2xl border border-cu-danger/20 bg-cu-bg p-6 text-center shadow-cu-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cu-danger/10 text-cu-danger">
          <AlertCircle size={22} />
        </div>
        <h2 className="text-[18px] font-bold text-cu-text-primary">{title}</h2>
        {subtitle && <p className="mt-2 text-[13px] leading-relaxed text-cu-text-secondary">{subtitle}</p>}
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cu-primary px-4 py-2.5 text-sm font-semibold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cu-primary focus-visible:ring-offset-2"
          >
            <RefreshCw size={14} />
            {retryLabel}
          </button>
          {action}
        </div>
      </div>
    </div>
  );
}
