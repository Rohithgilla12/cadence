import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { Avatar, Button } from '@/components/primitives';
import { HealthConnectCard } from '@/components/health/HealthConnectCard';
import { Screen, SectionLabel } from '@/components/layout';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/client';
import { getStatus } from '@/lib/health';
import type { HealthAuthStatus } from '@/lib/health';
import { colors } from '@/theme/tokens';

export default function YouScreen() {
  const { signOut, user } = useAuth();
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });

  const [healthStatus, setHealthStatus] = useState<HealthAuthStatus>('unknown');

  // Re-check HealthKit auth every time the tab gains focus so a fresh grant
  // from /connect-health flips the card to "Connected" without an app reload.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getStatus().then((nextStatus) => {
        if (!cancelled) setHealthStatus(nextStatus);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      Alert.alert('Sign-out failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  if (meQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      </Screen>
    );
  }

  if (meQuery.isError) {
    return (
      <Screen scroll={false}>
        <Text className="text-body text-ink-2">
          We couldn't reach the server. Pull down to retry once that's wired in.
        </Text>
      </Screen>
    );
  }

  const me = meQuery.data;
  const displayName = me?.displayName || user?.displayName || 'Quiet traveler';
  const email = me?.email || user?.email || '';

  return (
    <Screen>
      <Text className="font-serif text-h1 text-ink">You</Text>

      <View className="mt-6 flex-row items-center gap-3">
        <Avatar name={displayName} size={72} />
        <View className="flex-1">
          <Text className="text-h3 text-ink font-medium">{displayName}</Text>
          {email ? <Text className="text-body-sm text-ink-2 mt-0.5">{email}</Text> : null}
        </View>
      </View>

      <SectionLabel label="INTEGRATIONS" />
      <HealthConnectCard status={healthStatus} />

      <SectionLabel label="ACCOUNT" />
      <Button label="Sign out" variant="ghost" onPress={handleSignOut} />
    </Screen>
  );
}
