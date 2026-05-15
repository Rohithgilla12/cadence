import {
  IconBrandStrava,
  IconChevronRight,
} from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { apiClient } from '@/lib/client';
import { connectFlow, disconnectFlow } from '@/lib/strava';
import { colors } from '@/theme/tokens';

// Settings card for the Strava integration (PRD §9). Mirrors the
// Apple Health card visually so the two integrations sit beside each
// other under INTEGRATIONS. State machine: not-connected → tap →
// WebBrowser → cadence://strava/connected → refetch status → shows
// athlete name + Disconnect affordance.

const STATUS_QUERY_KEY = ['settings-strava-status'] as const;

export function StravaConnectCard() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: endpoints.stravaStatus(apiClient),
    staleTime: 30_000,
  });

  const connect = useMutation({
    mutationFn: connectFlow,
    onSuccess: async (result) => {
      if (result.kind === 'connected') {
        await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
        return;
      }
      if (result.kind === 'failed') {
        Alert.alert(
          'Could not connect',
          `Strava returned an error: ${result.reason}. Try again in a minute.`,
        );
      }
      // 'cancelled' is silent — the user just dismissed the sheet.
    },
    onError: (err) => {
      Alert.alert(
        'Could not connect',
        err instanceof Error ? err.message : 'Unknown error',
      );
    },
  });

  const disconnect = useMutation({
    mutationFn: disconnectFlow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
    onError: (err) => {
      Alert.alert(
        'Could not disconnect',
        err instanceof Error ? err.message : 'Unknown error',
      );
    },
  });

  const status = statusQuery.data;
  const connected = status?.connected === true;
  const busy = connect.isPending || disconnect.isPending;

  function handleTap() {
    if (busy) return;
    if (connected) {
      Alert.alert(
        'Disconnect Strava?',
        'Cadence will stop pulling new activities. Already-imported runs stay.',
        [
          { text: 'Keep connected', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: () => disconnect.mutate(),
          },
        ],
      );
      return;
    }
    connect.mutate();
  }

  const subtitle = busy
    ? 'Working…'
    : connected
      ? status?.athleteName
        ? `Connected as ${status.athleteName}`
        : 'Connected'
      : 'Not connected';

  return (
    <Card padding="md">
      <Pressable
        onPress={handleTap}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Strava connection"
        className="flex-row items-center gap-3"
        style={({ pressed }) => (pressed && !busy ? { opacity: 0.9 } : undefined)}
      >
        <View className="w-9 h-9 rounded-full bg-moss-bg items-center justify-center">
          <IconBrandStrava size={18} color={colors.moss} strokeWidth={1.5} />
        </View>
        <View className="flex-1">
          <Text className="text-body text-ink font-medium">Strava</Text>
          <Text className="text-caption text-ink-3 mt-0.5">{subtitle}</Text>
        </View>
        <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.5} />
      </Pressable>
    </Card>
  );
}
