import { IconArrowLeft, IconHeartbeat, IconPencil, IconTrash } from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { StreakPill } from '@/components/habit';
import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { iconFor } from '@/lib/mockData';
import { colors } from '@/theme/tokens';
import type { ApiHabitSourceLink } from '@/lib/api/types';

const SOURCE_LINK_VERB: Record<string, string> = {
  run: 'Running workouts',
  walk: 'Walking workouts',
  cycling: 'Cycling workouts',
  yoga: 'Yoga sessions',
  hike: 'Hikes',
  swim: 'Swims',
};

function sourceLinkSummary(link: ApiHabitSourceLink): string {
  const parts: string[] = [];
  parts.push(SOURCE_LINK_VERB[link.activity] ?? link.activity);
  if (link.minMinutes !== undefined && link.minMinutes > 0) {
    parts.push(`${link.minMinutes}+ min`);
  }
  if (link.window) {
    parts.push(`${link.window.start}–${link.window.end}`);
  }
  return parts.join(' · ');
}

export default function HabitDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const habitId = String(params.id ?? '');

  // Resolve the habit by filtering the listHabits cache. listHabits is
  // already fetched on Today and shares a cache key — no separate endpoint
  // needed for one-habit detail (PRD §11 habits are small per user).
  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });
  const habit = useMemo(
    () => habitsQuery.data?.find((h) => h.id === habitId),
    [habitsQuery.data, habitId],
  );

  // Pull all insights, filter to this habit. listInsights also caches across
  // surfaces — Reflect renders the same data unfiltered.
  const insightsQuery = useQuery({
    queryKey: queryKeys.insights,
    queryFn: endpoints.listInsights(apiClient),
    staleTime: 60 * 60_000,
  });
  const insights = useMemo(
    () => (insightsQuery.data ?? []).filter((i) => i.habitId === habitId),
    [insightsQuery.data, habitId],
  );

  const archiveMutation = useMutation({
    mutationFn: () => endpoints.archiveHabit(apiClient)(habitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
      router.back();
    },
    onError: (err) => {
      Alert.alert('Could not archive', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  function confirmArchive() {
    if (!habit) return;
    Alert.alert(
      'Archive this practice?',
      `${habit.name} stays in your history. You can add it back any time.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => archiveMutation.mutate() },
      ],
    );
  }

  const HabitIcon = habit ? iconFor[habit.icon] : null;

  return (
    <Screen scroll>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="self-start py-2 -ml-2 px-2 mb-2"
        hitSlop={8}
      >
        <IconArrowLeft size={22} color={colors.ink} strokeWidth={1.5} />
      </Pressable>

      {habitsQuery.isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : !habit ? (
        <Text className="text-body text-ink-2 mt-4">This practice is no longer in your list.</Text>
      ) : (
        <>
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-3 flex-1">
              {HabitIcon ? (
                <HabitIcon size={20} color={colors.moss} strokeWidth={1.5} />
              ) : null}
              <Text className="text-h2 font-serif text-ink flex-1">{habit.name}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.push({ pathname: '/habit/edit/[id]', params: { id: habitId } })}
                accessibilityRole="button"
                accessibilityLabel="Edit practice"
                hitSlop={8}
              >
                <IconPencil size={18} color={colors.ink2} strokeWidth={1.5} />
              </Pressable>
              <StreakPill count={habit.streak} />
            </View>
          </View>

          {habit.target ? (
            <Text className="text-caption text-ink-3 mt-1">
              {habit.target.value} {habit.target.unit} · {habit.timeOfDay}
            </Text>
          ) : (
            <Text className="text-caption text-ink-3 mt-1 capitalize">{habit.timeOfDay}</Text>
          )}

          {habit.sourceLink ? (
            <View className="mt-6">
              <SectionLabel label="TRACKING VIA" className="!mt-0" />
              <Card padding="md">
                <View className="flex-row items-center gap-2 mb-1">
                  <IconHeartbeat size={14} color={colors.moss} strokeWidth={1.5} />
                  <Text className="text-body text-ink font-medium">Apple Health</Text>
                </View>
                <Text className="text-caption text-ink-3">
                  {sourceLinkSummary(habit.sourceLink)}
                </Text>
              </Card>
            </View>
          ) : null}

          <SectionLabel label="PATTERNS" />
          {insightsQuery.isLoading ? (
            <View className="py-4 items-center">
              <ActivityIndicator color={colors.moss} />
            </View>
          ) : insights.length === 0 ? (
            <Card padding="md">
              <Text className="text-body text-ink-2 font-serif italic">
                Cadence is listening. Patterns appear when there's enough to bet on.
              </Text>
            </Card>
          ) : (
            <View className="gap-2">
              {insights.map((insight) => {
                const isStrong = insight.effectSize >= 0.35;
                return (
                  <Card key={insight.id} padding="md">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-eyebrow text-moss uppercase">
                        {isStrong ? 'STRONG PATTERN' : 'PATTERN'}
                      </Text>
                      <Text className="text-micro text-ink-3">{insight.sampleSize} days</Text>
                    </View>
                    <Text className="text-body text-ink leading-relaxed">
                      {insight.renderedText}
                    </Text>
                  </Card>
                );
              })}
            </View>
          )}

          <View className="mt-10">
            <Pressable
              onPress={confirmArchive}
              accessibilityRole="button"
              accessibilityLabel="Archive practice"
              disabled={archiveMutation.isPending}
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
              className="flex-row items-center justify-center gap-2 py-3"
            >
              <IconTrash size={14} color={colors.ink3} strokeWidth={1.5} />
              <Text className="text-body-sm text-ink-3">
                {archiveMutation.isPending ? 'Archiving…' : 'Archive this practice'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}
