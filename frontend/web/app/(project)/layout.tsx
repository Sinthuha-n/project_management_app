'use client';

import { useEffect, useRef } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import FullLayout from '@/components/layout/FullLayout';
import api from '@/lib/axios';
import { AUTH_TOKEN_CHANGED_EVENT, ensureValidToken } from '@/lib/auth';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

/**
 * Unified Project Layout
 * 
 * Provides a shared Sidebar + TopBar shell for all project tools:
 * - summary/[projectId]
 * - project/[id]/chat
 * - backlog
 * - timeline
 * - calendar
 * - members
 * - pages
 * 
 * This ensures that navigating between project tabs does not re-mount the FullLayout,
 * providing a smooth SPA feel.
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const isChatRoute = pathname?.includes('/chat');
  const isInboxRoute = pathname?.startsWith('/inbox');
  const isMembersRoute = pathname?.startsWith('/members');

  // Try to resolve projectId from path params or query params
  const projectId = (params?.projectId || params?.id || searchParams.get('projectId')) as string | undefined;

  // Guard: only run syncProjectContext once per projectId
  const syncedProjectIdRef = useRef<string | null>(null);
  const recordedAccessProjectIdRef = useRef<string | null>(null);
  const projectKey = projectId ? `/api/projects/${projectId}` : null;
  const { data: projectData } = useSWR(projectKey, fetcher, {
    revalidateIfStale: true,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    let isMounted = true;

    const ensureAuthenticated = async () => {
      const token = await ensureValidToken({ allowCookieRefresh: true });
      if (!token && isMounted) {
        router.replace('/login');
      }
      return token;
    };

    const syncProjectContext = async () => {
      const token = await ensureAuthenticated();
      if (!token) return;

      if (!projectId) return;
      // Skip if we already synced this project
      if (syncedProjectIdRef.current === projectId) return;
      syncedProjectIdRef.current = projectId;

      // Keep project context scoped to this tab while preserving global fallback.
      sessionStorage.setItem('currentProjectId', projectId);
      localStorage.setItem('currentProjectId', projectId);
    };

    const handleAuthTokenChanged = () => {
      void ensureAuthenticated();
    };

    void syncProjectContext();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);

    return () => {
      isMounted = false;
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleAuthTokenChanged);
    };
  }, [projectId, router]);

  useEffect(() => {
    if (!projectId || !projectData) return;

    sessionStorage.setItem('currentProjectId', projectId);
    localStorage.setItem('currentProjectId', projectId);

    if (projectData.name) {
      sessionStorage.setItem('currentProjectName', projectData.name);
      localStorage.setItem('currentProjectName', projectData.name);
    }

    if (projectData.type) {
      sessionStorage.setItem('currentProjectType', projectData.type);
      localStorage.setItem('currentProjectType', projectData.type);
    }

    window.dispatchEvent(new Event('storage'));
  }, [projectData, projectId]);

  useEffect(() => {
    if (!projectId || recordedAccessProjectIdRef.current === projectId) return;
    recordedAccessProjectIdRef.current = projectId;

    const timeoutId = window.setTimeout(() => {
      api.post(`/api/projects/${projectId}/access`)
        .then(() => {
          window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        })
        .catch(() => {
          recordedAccessProjectIdRef.current = null;
        });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [projectId]);

  return (
    <FullLayout>
      <main
        className={
          isChatRoute
            ? 'h-full min-h-0 flex flex-col overflow-hidden'
            : isInboxRoute || isMembersRoute
              ? 'flex flex-col min-h-full'
              : 'flex flex-col min-h-full'
        }
      >
        {children}
      </main>
    </FullLayout>
  );
}
