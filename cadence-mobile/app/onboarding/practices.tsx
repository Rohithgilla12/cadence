import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionTile, StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { suggestedHabitsFor } from '@/lib/onboarding';
import type { PillarId, SuggestedHabit } from '@/lib/onboarding';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function PracticesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });

  const suggestions = useMemo(() => {
    const pillars = (meQuery.data?.pillars ?? []) as PillarId[];
    return suggestedHabitsFor(pillars);
  }, [meQuery.data]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default: every suggestion checked, but capped at 4 to keep the start gentle.
  useEffect(() => {
    if (suggestions.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const defaults = new Set<string>();
      suggestions.slice(0, 4).forEach((h) => defaults.add(h.id));
      return defaults;
    });
  }, [suggestions]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const finishMutation = useMutation({
    mutationFn: async () => {
      const chosen = suggestions.filter((h) => selected.has(h.id));
      const create = endpoints.createHabit(apiClient);
      // Serial to avoid hammering the API for a small set; ~150ms each is fine.
      for (const habit of chosen) {
        await create({
          name: habit.name,
          icon: habit.icon,
          timeOfDay: habit.timeOfDay,
          trackContext: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
      router.replace('/');
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  if (meQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={4} total={4} />
        <View className="mt-6">
          <StepHeader
            title="Pick a few practices to start."
            subtitle="Two is plenty for the first week."
          />
        </View>
        {suggestions.length === 0 ? (
          <Text className="mt-8 text-body text-ink-2">
            We'll surface suggestions once your pillars are set. You can add practices manually from Today.
          </Text>
        ) : (
          <View className="mt-8 gap-3">
            {suggestions.map((habit) => (
              <OptionTile
                key={habit.id}
                label={habit.name}
                description={timeOfDayLabel(habit.timeOfDay)}
                selected={selected.has(habit.id)}
                onPress={() => toggle(habit.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPaddingX,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 0.5,
          borderTopColor: colors.hairline,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={finishMutation.isPending ? 'Setting up…' : 'Begin'}
          variant="primary"
          fullWidth
          disabled={finishMutation.isPending}
          onPress={() => finishMutation.mutate()}
        />
      </View>
    </View>
  );
}

function timeOfDayLabel(timeOfDay: SuggestedHabit['timeOfDay']): string {
  switch (timeOfDay) {
    case 'morning': return 'Morning';
    case 'midday':  return 'Midday';
    case 'evening': return 'Evening';
    default:        return 'Anytime';
  }
}
