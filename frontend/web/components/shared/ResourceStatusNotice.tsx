'use client';

import React from 'react';

export type ResourceStatusKind = 'access' | 'conflict' | 'unavailable' | 'upload';

const copy: Record<ResourceStatusKind, string> = {
  access: 'This resource is no longer available to your account.',
  conflict: 'This resource changed elsewhere. Refresh to review the latest version before trying again.',
  unavailable: 'This service is temporarily unavailable. Your current input has not been discarded.',
  upload: 'The upload was not made visible. Review the file and try again.',
};

export function ResourceStatusNotice({ kind, message, onRefresh }: { kind: ResourceStatusKind; message?: string; onRefresh?: () => void }) {
  return <div role="status" aria-live="polite" className="mb-3 rounded-lg border border-cu-border bg-cu-bg-secondary px-3 py-2 text-sm text-cu-text-secondary">
    <span>{message || copy[kind]}</span>
    {kind === 'conflict' && onRefresh && <button type="button" onClick={onRefresh} className="ml-3 font-semibold text-cu-primary underline">Reload latest</button>}
  </div>;
}
