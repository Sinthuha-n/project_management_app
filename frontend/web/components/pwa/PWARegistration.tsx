'use client';

import { useEffect } from 'react';

export const PWA_UPDATE_AVAILABLE_EVENT = 'planora:pwa-update-available';

export type PWAUpdateAvailableDetail = {
  registration: ServiceWorkerRegistration;
};

export function shouldRegisterServiceWorker({
  hasServiceWorker,
  protocol,
  hostname,
}: {
  hasServiceWorker: boolean;
  protocol: string;
  hostname: string;
}): boolean {
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  return hasServiceWorker && (protocol === 'https:' || isLocalhost);
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

export default function PWARegistration() {
  useEffect(() => {
    applyStandaloneMarker(isStandaloneMode());

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
        })
        .catch(() => undefined);
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register, { once: true });

    return () => {
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
