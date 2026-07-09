'use client';

import { useEffect, useRef } from 'react';
import { toast } from '@/components/ui/Toast';
import {
  PWA_UPDATE_AVAILABLE_EVENT,
  type PWAUpdateAvailableDetail,
} from './PWARegistration';

function debugPwa(message: string, detail?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[planora-pwa] ${message}`, detail || '');
  }
}

export default function PWAUpdateToast() {
  const waitingRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadAfterControllerChangeRef = useRef(false);
  const shownForWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    const applyUpdate = () => {
      const waitingWorker = waitingRegistrationRef.current?.waiting;
      if (!waitingWorker) {
        window.location.reload();
        return;
      }

      reloadAfterControllerChangeRef.current = true;
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    };

    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent<PWAUpdateAvailableDetail>;
      const registration = customEvent.detail?.registration;
      const waitingWorker = registration?.waiting;
      if (!registration || !waitingWorker || shownForWorkerRef.current === waitingWorker) return;

      waitingRegistrationRef.current = registration;
      shownForWorkerRef.current = waitingWorker;
      debugPwa('Showing update prompt');
      toast('Update available', 'info', 600_000, 'Refresh', applyUpdate);
    };

    const handleControllerChange = () => {
      if (!reloadAfterControllerChangeRef.current) return;
      debugPwa('Reloading after service worker update');
      reloadAfterControllerChangeRef.current = false;
      window.location.reload();
    };

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    navigator.serviceWorker?.addEventListener?.('controllerchange', handleControllerChange);

    return () => {
      window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
      navigator.serviceWorker?.removeEventListener?.('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
