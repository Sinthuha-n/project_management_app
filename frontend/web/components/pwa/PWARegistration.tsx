'use client';

import { useEffect } from 'react';

export const PWA_UPDATE_AVAILABLE_EVENT = 'planora:pwa-update-available';
export const PWA_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type PWAUpdateAvailableDetail = {
  registration: ServiceWorkerRegistration;
};

export function shouldRegisterServiceWorker({
  hasServiceWorker,
  protocol,
  hostname,
  environment = process.env.NODE_ENV,
}: {
  hasServiceWorker: boolean;
  protocol: string;
  hostname: string;
  environment?: string;
}): boolean {
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  return environment !== 'development' && hasServiceWorker && (protocol === 'https:' || isLocalhost);
}

export async function cleanupDevelopmentPwa(): Promise<void> {
  if ('serviceWorker' in navigator && typeof navigator.serviceWorker.getRegistrations === 'function') {
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registrations
      .filter((registration) => {
        try {
          return new URL(registration.scope).origin === window.location.origin;
        } catch {
          return false;
        }
      })
      .map((registration) => registration.unregister().catch(() => false)));
  }

  if ('caches' in window) {
    const cacheKeys = await window.caches.keys().catch(() => []);
    await Promise.all(cacheKeys
      .filter((key) => key.startsWith('planora-pwa-'))
      .map((key) => window.caches.delete(key).catch(() => false)));
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(
    standaloneNavigator.standalone
    || window.matchMedia?.('(display-mode: standalone)').matches,
  );
}

export function applyStandaloneMarker(standalone: boolean): void {
  document.documentElement.dataset.pwaStandalone = standalone ? 'true' : 'false';
  document.documentElement.classList.toggle('pwa-standalone', standalone);
}

function debugPwa(message: string, detail?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[planora-pwa] ${message}`, detail || '');
  }
}

function emitUpdateAvailable(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(new CustomEvent<PWAUpdateAvailableDetail>(PWA_UPDATE_AVAILABLE_EVENT, {
    detail: { registration },
  }));
}

function watchForUpdates(registration: ServiceWorkerRegistration): void {
  if (registration.waiting && navigator.serviceWorker.controller) {
    debugPwa('Service worker update already waiting');
    emitUpdateAvailable(registration);
  }

  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
        debugPwa('Service worker update installed and waiting');
        emitUpdateAvailable(registration);
      }
    });
  });
}

function checkForServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  if (typeof registration.update !== 'function') return;
  registration.update().catch(() => undefined);
}

function attachUpdateChecks(registration: ServiceWorkerRegistration): () => void {
  checkForServiceWorkerUpdate(registration);

  const handleFocus = () => checkForServiceWorkerUpdate(registration);
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkForServiceWorkerUpdate(registration);
    }
  };
  const intervalId = window.setInterval(
    () => checkForServiceWorkerUpdate(registration),
    PWA_UPDATE_CHECK_INTERVAL_MS,
  );

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export default function PWARegistration() {
  useEffect(() => {
    applyStandaloneMarker(isStandaloneMode());
    let detachUpdateChecks: (() => void) | null = null;

    if (process.env.NODE_ENV === 'development') {
      void cleanupDevelopmentPwa();
      return;
    }

    if (!shouldRegisterServiceWorker({
      hasServiceWorker: 'serviceWorker' in navigator,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    })) {
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        .then((registration) => {
          debugPwa('Service worker registered', registration.scope);
          watchForUpdates(registration);
          detachUpdateChecks?.();
          detachUpdateChecks = attachUpdateChecks(registration);
        })
        .catch(() => undefined);
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      window.removeEventListener('load', register);
      detachUpdateChecks?.();
    };
  }, []);

  return null;
}
