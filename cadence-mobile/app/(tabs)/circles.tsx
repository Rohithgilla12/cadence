import { IconChevronRight, IconPlus, IconUsersGroup } from '@tabler/icons-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';
import type { ApiCircle } from '@/lib/api/types';

export default function CirclesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.circles });
    setRefreshing(false);
  }, [queryClient]);

  const circlesQuery = useQuery({
    queryKey: queryKeys.circles,
    queryFn: endpoints.listCircles(apiClient),
  });

  const circles = circlesQuery.data ?? [];

  return (
    <Screen scroll>
      <Text className="text-body-sm text-ink-3">Small. Quiet.</Text>
      <Text className="text-h1 font-serif text-ink mt-0.5">Circles</Text>
      <Text className="mt-3 text-body text-ink-2">
        Three to five friends with a shared pact. Start one, or paste an invite.
      </Text>

      {circlesQuery.isLoading ? (
        <View className="py-8 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : circles.length === 0 ? (
        <View className="mt-8">
          <View className="bg-paper-2 rounded-2xl p-5 items-center">
            <IconUsersGroup size={28} color={colors.mossLight} strokeWidth={1.5} />
            <Text className="text-body text-ink-2 mt-3 text-center">
              No circles yet. Cadence is best with two or three friends.
            </Text>
          </View>
        </View>
      ) : (
        <View className="mt-6">
          <SectionLabel label={`YOUR CIRCLES · ${circles.length}`} className="!mt-0" />
          <View className="gap-2">
            {circles.map((circle) => (
              <CircleRow
                key={circle.id}
                circle={circle}
                onPress={() =>
                  router.push({ pathname: '/circle/[id]', params: { id: circle.id } })
                }
              />
            ))}
          </View>
        </View>
      )}

      <View className="mt-8 gap-2">
        <ActionRow
          label="Start a circle"
          icon={<IconPlus size={18} color={colors.moss} strokeWidth={1.5} />}
          onPress={() => router.push('/circle/new')}
        />
        <ActionRow
          label="Paste an invite"
          icon={<IconUsersGroup size={18} color={colors.moss} strokeWidth={1.5} />}
          onPress={() => router.push('/circle/join')}
        />
      </View>
    </Screen>
  );
}

function CircleRow({ circle, onPress }: { circle: ApiCircle; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${circle.name}`}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
    >
      <Card padding="md">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-body text-ink font-medium">{circle.name}</Text>
            {circle.description ? (
              <Text className="text-caption text-ink-3 mt-0.5">{circle.description}</Text>
            ) : null}
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.5} />
        </View>
      </Card>
    </Pressable>
  );
}

function ActionRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 bg-card border border-hairline rounded-xl p-4 active:opacity-90"
    >
      {icon}
      <Text className="flex-1 text-body text-ink">{label}</Text>
      <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.5} />
    </Pressable>
  );
}
