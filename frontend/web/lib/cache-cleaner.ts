'use client';

import { clearAllSessionCacheData } from '@/lib/session-cache';

/**
 * Known persistent storage keys that should be preserved across logouts.
 * For instance, user theme preference ('planora-theme') is a device UI preference.
 */
const PRESERVED_STORAGE_KEYS = new Set<string>([
  'planora-theme',
]);

/**
 * Comprehensively clears all browser caches, session data, token storage,
 * and CacheStorage caches created during the active user session.
 */
export async function clearAllBrowserCachesAndStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Clear session cache structures
  try {
    clearAllSessionCacheData();
  } catch (error) {
    console.debug('[cache-cleaner] Error clearing session cache data', error);
  }

  // 2. Clear LocalStorage entries (preserving only theme preference)
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && !PRESERVED_STORAGE_KEYS.has(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore single key removal errors
      }
    });
  } catch (error) {
    console.debug('[cache-cleaner] Error cleaning localStorage', error);
  }

  // 3. Clear all SessionStorage entries completely
  try {
    sessionStorage.clear();
  } catch (error) {
    console.debug('[cache-cleaner] Error cleaning sessionStorage', error);
  }

  // 4. Clear all CacheStorage entries (ServiceWorker / PWA / fetch caches)
  try {
    if ('caches' in window && typeof caches !== 'undefined' && caches.keys) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          try {
            await caches.delete(cacheName);
          } catch {
            // Ignore single cache delete failure
          }
        }),
      );
    }
  } catch (error) {
    console.debug('[cache-cleaner] Error deleting CacheStorage entries', error);
  }

  // 5. Best-effort IndexedDB cleanup if databases exist
  try {
    if (
      'indexedDB' in window
      && typeof indexedDB !== 'undefined'
      && typeof indexedDB.databases === 'function'
    ) {
      const databases = await indexedDB.databases();
      if (Array.isArray(databases)) {
        databases.forEach((dbInfo) => {
          if (dbInfo.name && !PRESERVED_STORAGE_KEYS.has(dbInfo.name)) {
            try {
              indexedDB.deleteDatabase(dbInfo.name);
            } catch {
              // Ignore single database delete failure
            }
          }
        });
      }
    }
  } catch (error) {
    console.debug('[cache-cleaner] Error deleting IndexedDB databases', error);
  }
}
