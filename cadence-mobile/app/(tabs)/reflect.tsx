import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { InsightCard } from '@/components/insight';
import { Screen, SectionLabel } from '@/components/layout';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import type { Insight } from '@/types';

// Reflect is the wedge surface — once the correlation engine ships, this is
// where context-aware insights live (PRD §7, §8). Until then it's an honest
// listening state per PRD §20. We do NOT fabricate insights to fill space.
const LISTENING_INSIGHT: Insight = { kind: 'listening' };

export default function ReflectScreen() {
  // Read the user's habits so we can tailor the listening copy. If they have
  // habits, lean into the patience message; if they're brand new, explain the
  // shape of what's coming. No fake patterns either way.
  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });

  const habitCount = habitsQuery.data?.length ?? 0;

  return (
    <Screen scroll>
      <Text className="text-body-sm text-ink-3">Weekly mirror</Text>
      <Text className="text-h1 font-serif text-ink mt-0.5">Reflect</Text>

      <View className="mt-6">
        <InsightCard insight={LISTENING_INSIGHT} />
      </View>

      <SectionLabel label="WHAT'S COMING" />

      <Text className="text-body text-ink-2 leading-relaxed">
        After about two weeks of daily check-ins, this is where the patterns
        surface — what predicts your runs, which mornings you tend to skip,
        when your sleep moves with your mood.
      </Text>

      <Text className="text-body text-ink-2 leading-relaxed mt-4 font-serif italic">
        We only surface a pattern when the data is strong enough to bet on.
        Until then, keep showing up.
      </Text>

      <SectionLabel label="WHERE YOU ARE" />

      <View className="bg-paper-2 rounded-2xl p-4">
        <Text className="text-eyebrow text-ink-3 uppercase">PRACTICES</Text>
        <Text className="text-h2 font-serif text-ink mt-1">
          {habitsQuery.isLoading
            ? '—'
            : habitCount === 0
              ? 'None yet'
              : habitCount === 1
                ? '1 in your rhythm'
                : `${habitCount} in your rhythm`}
        </Text>
        {habitCount > 0 ? (
          <Text className="text-body-sm text-ink-2 mt-2">
            Check in daily. Cadence reads the shape of your week and waits
            for it to mean something.
          </Text>
        ) : (
          <Text className="text-body-sm text-ink-2 mt-2">
            Add a practice from Today to begin.
          </Text>
        )}
      </View>
    </Screen>
  );
}
