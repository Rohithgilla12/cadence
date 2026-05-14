import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalHeader, LineChoice, PageChapter } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { track } from '@/lib/analytics';
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

  // Default: nothing pre-checked. The journal flow asks the user to
  // make a deliberate choice — pre-checking four lines turns this from
  // a question into a confirmation, which clashes with PRD §3 voice.
  // Stays empty until the user taps.
  useEffect(() => {
    if (suggestions.length === 0) return;
    setSelected((prev) => prev);
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
      track({ name: 'onboarding_practices_chosen', count: selected.size });
      track({ name: 'onboarding_completed' });
      // /onboarding/listening is a new route added in the redesign; the
      // typed-route cache regenerates on dev-server start.
      router.replace('/onboarding/listening' as unknown as Parameters<typeof router.replace>[0]);
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  if (meQuery.isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  const subtitle =
    suggestions.length === 0
      ? "We'll surface suggestions once your pillars are set. You can add practices from Today."
      : 'Two or three is plenty for the first week. You can always add more.';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 28,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 48,
        }}
      >
        <PageChapter current={4} total={4} />
        <View className="mt-10">
          <JournalHeader
            eyebrow="What to begin with"
            title="A few practices."
            subtitle={subtitle}
          />
        </View>

        {suggestions.length > 0 ? (
          <View className="mt-8 -mx-3">
            {suggestions.map((habit) => (
              <LineChoice
                key={habit.id}
                mode="check"
                label={habit.name}
                description={timeOfDayLabel(habit.timeOfDay)}
                selected={selected.has(habit.id)}
                onPress={() => toggle(habit.id)}
              />
            ))}
          </View>
        ) : null}

        {suggestions.length > 0 && selected.size === 0 ? (
          <Text className="mt-6 text-body-sm text-ink-3 italic">
            Or skip — practices are easy to add later.
          </Text>
        ) : null}
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
