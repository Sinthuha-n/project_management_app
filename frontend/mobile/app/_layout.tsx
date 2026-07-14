import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import SplashAnimation from '@/src/components/SplashAnimation';
import { getValidToken } from '@/src/auth/storage';
import { offlineSyncManager } from '@/src/services/offlineSyncManager';
import { resolveMobileRoute, resolveNotificationRoute, routes } from '@/src/navigation/routes';

// Prevent the native splash from auto-hiding — we control it
SplashScreen.preventAutoHideAsync();

function NativeNotificationBridge({
  onNotificationResponse,
}: {
  onNotificationResponse: (response: NotificationResponseLike | null) => void;
}) {
  useEffect(() => {
    if (Constants.appOwnership === 'expo') {
      return;
    }

    let removeListener: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const Notifications = await import('expo-notifications');
      if (cancelled) {
        return;
      }

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!cancelled) {
        onNotificationResponse(lastResponse ?? null);
      }

      const subscription = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
      removeListener = () => subscription.remove();
    })().catch(() => {
      // Notification navigation is best effort and must not block app startup.
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [onNotificationResponse]);

  return null;
}

type NotificationResponseLike = {
  notification: {
    request: {
      identifier: string;
      content: {
        data?: Record<string, unknown>;
      };
    };
  };
};

/**
 * Root layout — declares all route groups.
 *
 * Auth flow:
 *  ┌─ app/index.tsx              → Landing (checks token → redirects)
 *  ├─ app/(auth)/*               → Login / Register / Forgot / Verify / Reset
 *  ├─ app/(tabs)/*               → Main app with floating bottom nav
 *  │    ├─ index                 → Dashboard (Home)
 *  │    ├─ spaces                → My Spaces
 *  │    ├─ inbox                 → Inbox
 *  │    └─ profile               → Profile
 *  ├─ app/create-project/*       → 3-step Create Project flow
 *  │    ├─ index                 → Step 1: Select project type
 *  │    ├─ setup                 → Step 2: Project details & team
 *  │    └─ invite                → Step 3: Invite team members
 *  └─ app/portfolios/*           → Portfolio management
 *       ├─ index                 → Portfolio list
 *       └─ [id]                  → Portfolio detail with metrics
 */
export default function RootLayout() {
  const router = useRouter();
  const [showSplash,   setShowSplash]   = useState(true);
  const [authChecked,  setAuthChecked]  = useState(false);
  const [isAuthed,     setIsAuthed]     = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const seenNotificationIds = useRef(new Set<string>());

  const destination = useMemo(() => {
    if (!isAuthed) {
      return (pendingRoute ?? routes.landing) as Parameters<typeof router.replace>[0];
    }

    return (pendingRoute ?? routes.tabs) as Parameters<typeof router.replace>[0];
  }, [isAuthed, pendingRoute, router]);

  const handleNotificationResponse = useCallback((response: NotificationResponseLike | null) => {
    if (!response) {
      return;
    }

    const notificationId = response.notification.request.identifier;
    if (seenNotificationIds.current.has(notificationId)) {
      return;
    }

    seenNotificationIds.current.add(notificationId);
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const route = resolveNotificationRoute(data);
    if (route) {
      setPendingRoute(String(route));
    }
  }, []);

  const handleIncomingUrl = useCallback((url: string | null) => {
    if (!url) return;
    const route = resolveMobileRoute(url);
    if (route) {
      setPendingRoute(String(route));
      if (!showSplash && authChecked) router.replace(route);
    }
  }, [authChecked, router, showSplash]);

  // Check auth in background while animation plays
  useEffect(() => {
    // Hide the native OS splash immediately — our JS splash takes over
    SplashScreen.hideAsync();

    (async () => {
      await offlineSyncManager.init();
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl) {
        const route = resolveMobileRoute(initialUrl);
        if (route) setPendingRoute(String(route));
      }
      const token = await getValidToken();
      setIsAuthed(!!token);
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => subscription.remove();
  }, [handleIncomingUrl]);

  // Called by SplashAnimation when exit animation finishes
  const handleSplashFinished = useCallback(() => {
    setShowSplash(false);
    // Auth check is almost certainly done by now (it's < 300ms),
    // but await it just in case
    if (authChecked) {
      router.replace(destination);
    }
    // If not done, the effect below will fire when authChecked flips
  }, [authChecked, destination, router]);

  // Safety net: if auth resolves AFTER animation finished
  useEffect(() => {
    if (!showSplash && authChecked) {
      router.replace(destination);
    }
  }, [showSplash, authChecked, destination, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.root}>
        {Platform.OS !== 'web' && (
          <NativeNotificationBridge onNotificationResponse={handleNotificationResponse} />
        )}

        {/* Stack navigator — always mounted so screens can prepare */}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index"                  options={{ headerShown: false }} />
          <Stack.Screen name="(auth)"                 options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)"                 options={{ headerShown: false }} />
          <Stack.Screen name="summary/[projectId]"    options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="board/[projectId]"      options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="create-project/index"   options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="create-project/setup"   options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="create-project/invite"  options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="dashboard/notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="accept-invite"                    options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="portfolios/index"                options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="portfolios/[id]"                 options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="project/[projectId]/settings"    options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/github"                 options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="github-callback"                 options={{ headerShown: false }} />
          <Stack.Screen name="modal"                           options={{ presentation: 'modal' }} />
        </Stack>

        {/* Custom splash overlaid above everything, removed after animation */}
        {showSplash && (
          <SplashAnimation onFinished={handleSplashFinished} />
        )}

        <StatusBar style="light" />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
