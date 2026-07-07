'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTH_TOKEN_CHANGED_EVENT, ensureValidToken, getValidToken } from '@/lib/auth';

const PUBLIC_PATH_PATTERNS = [
  /^\/$/,
  /^\/(login|register|signup|forgot-password|reset-password|verify-email)(\/|$)/,
  /^\/accept-invite(\/|$)/,
  /^\/github\/callback(\/|$)/,
  /^\/api(\/|$)/,
];

function isPublicPath(pathname: string | null): boolean {
  const path = pathname || '/';
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export default function AuthBootstrapProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const protectedRoute = useMemo(() => !isPublicPath(pathname), [pathname]);
  const [ready, setReady] = useState(() => !protectedRoute || Boolean(getValidToken()));

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      if (!protectedRoute) {
        setReady(true);
        return;
      }

      setReady(Boolean(getValidToken()));
      const token = await ensureValidToken({ allowCookieRefresh: true });
      if (cancelled) return;

      if (!token) {
        setReady(false);
        router.replace('/login');
        return;
      }

      setReady(true);
    }

    void bootstrapAuth();
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, bootstrapAuth);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, bootstrapAuth);
    };
  }, [protectedRoute, router]);

  if (!ready) return null;

  return <>{children}</>;
}
