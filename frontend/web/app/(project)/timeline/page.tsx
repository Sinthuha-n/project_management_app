'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';

function TimelineRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const projectId = searchParams.get('projectId');
    if (projectId) {
      router.replace(`/timeline/${projectId}`);
    }
  }, [searchParams, router]);

  return null;
}

export default function TimelineRedirect() {
  return (
    <Suspense fallback={<RouteLoadingState title="Opening timeline" subtitle="Resolving the selected project." variant="detail" />}>
      <TimelineRedirectContent />
    </Suspense>
  );
}
