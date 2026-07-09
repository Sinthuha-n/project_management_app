'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Share, X } from 'lucide-react';

const DISMISSED_KEY = 'planora:pwa-ios-install-dismissed';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SUPPRESSED_PATH_PATTERNS = [
  /^\/taskcard(?:\/|$)/,
  /^\/report(?:\/|$)/,
  /^\/pages(?:\/|$)/,
  /^\/folders(?:\/|$)/,
];

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

export function isIOSUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  const normalized = userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(normalized) || (normalized.includes('macintosh') && maxTouchPoints > 1);
}

export function isSafariUserAgent(userAgent: string): boolean {
  return /safari/i.test(userAgent) && !/crios|fxios|edgios|opios|mercury/i.test(userAgent);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;

  const standaloneNavigator = window.navigator as StandaloneNavigator;
  return Boolean(
    standaloneNavigator.standalone
    || window.matchMedia?.('(display-mode: standalone)').matches,
  );
}

export function shouldShowIOSInstallPrompt(userAgent: string, maxTouchPoints = 0): boolean {
  return isIOSUserAgent(userAgent, maxTouchPoints) && isSafariUserAgent(userAgent) && !isStandaloneDisplay();
}

export function isInstallPromptDismissed(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;

  const rawDismissedUntil = localStorage.getItem(DISMISSED_KEY);
  if (!rawDismissedUntil) return false;

  if (rawDismissedUntil === 'true') {
    localStorage.removeItem(DISMISSED_KEY);
    return false;
  }

  const dismissedUntil = Number(rawDismissedUntil);
  if (!Number.isFinite(dismissedUntil) || dismissedUntil <= now) {
    localStorage.removeItem(DISMISSED_KEY);
    return false;
  }

  return true;
}

export function isInstallPromptSuppressedPath(pathname: string | null): boolean {
  const path = pathname || '/';
  return SUPPRESSED_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export default function IOSInstallPrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        if (isInstallPromptSuppressedPath(pathname) || isInstallPromptDismissed()) {
          setVisible(false);
          return;
        }

        const shouldShow = shouldShowIOSInstallPrompt(window.navigator.userAgent, window.navigator.maxTouchPoints);
        setVisible(shouldShow);
        if (shouldShow && process.env.NODE_ENV !== 'production') {
          console.debug('[planora-pwa] iOS install prompt shown');
        }
      } catch {
        setVisible(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_TTL_MS));
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[planora-pwa] iOS install prompt dismissed');
      }
    } catch {
      // Storage can be unavailable in private browsing; dismissal should still work.
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 z-[var(--cu-z-toast)] sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
      <div className="rounded-cu-xl border border-cu-border bg-cu-bg px-4 py-3 shadow-cu-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-cu-lg bg-cu-primary-light text-cu-primary">
            <Share size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cu-text-primary">Install Planora</p>
            <p className="mt-1 text-sm leading-5 text-cu-text-secondary">
              Tap Share, then Add to Home Screen for a full-screen iOS app experience.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="mobile-touch-target -mr-2 -mt-2 shrink-0 rounded-cu-md text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-text-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
