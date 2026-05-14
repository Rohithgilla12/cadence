import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand';
import { AuthProvider, useAuth, configureGoogleSignIn } from '@/lib/auth';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { QueryProvider } from '@/lib/query';
import { colors } from '@/theme/tokens';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (webClientId) {
  configureGoogleSignIn(webClientId);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
    enabled: status === 'signed-in',
  });

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
      router.replace('/onboarding/intent');
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
