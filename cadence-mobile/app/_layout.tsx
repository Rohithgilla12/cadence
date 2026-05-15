import '../global.css';

import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand';
import { initAnalytics } from '@/lib/analytics';
import { AuthProvider, useAuth, configureGoogleSignIn } from '@/lib/auth';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { QueryProvider } from '@/lib/query';
import { colors } from '@/theme/tokens';

// Configure once at module load. The helper uses `webClientId: 'autoDetect'`
// internally, so the Web OAuth client ID is read from google-services.json
// (Android) / GoogleService-Info.plist (iOS) — no env var to forget.
configureGoogleSignIn();

// Aptabase boot. Idempotent and safe to call at module load — the SDK
// only starts the flush timer here, and tracked events accumulate
// even before the app's UI mounts.
initAnalytics();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
    enabled: status === 'signed-in',
  });

  // Holds the unsubscribe for the notification-response listener so the
  // effect that registers it can also tear it down across re-mounts.
  const cleanupRef = useRef<(() => void) | null>(null);

  // Once we're authenticated AND the server says onboarding is done, ask
  // for the notification permission and post the FCM token. Idempotent on
  // every relaunch: server upserts on the token itself, OS only shows the
  // sheet the first time. Wrapped so a failed request doesn't block sign-in.
  useEffect(() => {
    if (status !== 'signed-in') return;
    if (!meQuery.data?.onboardingCompleted) return;
    let cancelled = false;
    (async () => {
      const { requestAndRegister } = await import('@/lib/push');
      if (cancelled) return;
      void requestAndRegister();
    })();
    return () => {
      cancelled = true;
    };
  }, [status, meQuery.data?.onboardingCompleted]);

  // Route push taps. Server sets data.deeplink (cadence://reflect, etc.)
  // and we steer the in-app router. Two paths:
  //   • cold-start: the notification that launched the app — checked once
  //     after onboarding is complete via handleInitialResponse.
  //   • warm: a listener that fires whenever the user taps a push while
  //     the app is open or backgrounded.
  useEffect(() => {
    if (status !== 'signed-in') return;
    if (!meQuery.data?.onboardingCompleted) return;
    let cancelled = false;
    (async () => {
      const { handleInitialResponse, handleResponse } = await import('@/lib/push/router');
      if (cancelled) return;
      void handleInitialResponse(router).catch(() => {});
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        handleResponse(response, router);
      });
      // Cleanup gets tied to the outer effect's return via closure.
      cleanupRef.current = () => sub.remove();
    })();
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [status, meQuery.data?.onboardingCompleted, router]);

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0];
    const inTabs = root === '(tabs)';
    const inOnboarding = root === 'onboarding';

    if (status === 'signed-out') {
      if (inTabs || inOnboarding) router.replace('/sign-in');
      return;
    }

    if (root === 'sign-in') {
      router.replace('/');
      return;
    }

    if (meQuery.isLoading || !meQuery.data) return;

    if (!meQuery.data.onboardingCompleted && !inOnboarding) {
      // /onboarding/welcome was added in the onboarding redesign. Expo
      // Router's typed-routes cache regenerates on dev-server start, so
      // until then the string isn't in the union — cast through unknown.
      router.replace('/onboarding/welcome' as unknown as Parameters<typeof router.replace>[0]);
    } else if (meQuery.data.onboardingCompleted && inOnboarding) {
      router.replace('/');
    }
  }, [status, segments, router, meQuery.isLoading, meQuery.data]);

  if (status === 'loading' || (status === 'signed-in' && meQuery.isLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-bg gap-8">
        <BrandMark size={64} variant="cream" />
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              >
                <Stack.Screen
                  name="add-habit"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="check-in"
                  options={{
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />
              </Stack>
            </AuthGate>
            <StatusBar style="dark" />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
