import { IconSparkles } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';

import { InsightCard } from '@/components/insight';
import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';
import type { ApiInsight } from '@/lib/api/types';
import type { Insight } from '@/types';

// Reflect is the wedge surface (PRD §7, §8). When the engine has found
// patterns it shows them all here, ranked by effect size. Until then it's
// an honest listening state — we never fabricate insights to fill space.
const LISTENING_INSIGHT: Insight = { kind: 'listening' };

export default function ReflectScreen() {
  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });
  const insightsQuery = useQuery({
    queryKey: queryKeys.insights,
    queryFn: endpoints.listInsights(apiClient),
    staleTime: 60 * 60_000,
  });

  const habitCount = habitsQuery.data?.length ?? 0;
  const insights = insightsQuery.data ?? [];
  const hasPatterns = insights.length > 0;

  return (
    <Screen scroll>
      <Text className="text-body-sm text-ink-3">Weekly mirror</Text>
      <Text className="text-h1 font-serif text-ink mt-0.5">Reflect</Text>

      {insightsQuery.isLoading ? (
        <View className="mt-8 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : hasPatterns ? (
        <PatternsList insights={insights} />
      ) : (
        <ListeningSection habitCount={habitCount} />
      )}
    </Screen>
  );
}

function PatternsList({ insights }: { insights: ApiInsight[] }) {
  return (
    <View className="mt-6 gap-3">
      <SectionLabel label={`PATTERNS · ${insights.length}`} className="!mt-0 !mb-3" />
      {insights.map((insight) => (
        <PatternRow key={insight.id} insight={insight} />
      ))}
      <Text className="text-caption text-ink-3 mt-3 font-serif italic">
        Observational, not causal. You do X more often when Y — not "Y makes you do X."
      </Text>
    </View>
  );
}

function PatternRow({ insight }: { insight: ApiInsight }) {
  const isStrong = insight.effectSize >= 0.35;
  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <IconSparkles size={12} color={colors.moss} strokeWidth={1.5} />
          <Text className="text-eyebrow text-moss uppercase">
            {isStrong ? 'STRONG PATTERN' : 'PATTERN'}
          </Text>
        </View>
        <Text className="text-micro text-ink-3">{insight.sampleSize} days</Text>
      </View>
      <Text className="text-body text-ink leading-relaxed">{insight.renderedText}</Text>
    </Card>
  );
}

function ListeningSection({ habitCount }: { habitCount: number }) {
  return (
    <>
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
          {habitCount === 0
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
    </>
  );
}
