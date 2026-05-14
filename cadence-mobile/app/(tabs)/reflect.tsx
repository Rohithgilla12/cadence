import { IconFlame, IconSparkles } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ConsistencyHeatmap, RhythmBars } from '@/components/charts';
import { InsightCard } from '@/components/insight';
import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { iconFor } from '@/lib/mockData';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors } from '@/theme/tokens';
import type { ApiHabit, ApiHeatmap, ApiInsight, ApiRhythm } from '@/lib/api/types';
import type { Insight } from '@/types';

const RHYTHM_WINDOW_DAYS = 56;
const HEATMAP_WINDOW_DAYS = 63; // 9 weeks for a clean 9-col grid

// Reflect is the wedge surface (PRD §7, §8). When the engine has found
// patterns it shows them all here, ranked by effect size. Until then it's
// an honest listening state — we never fabricate insights to fill space.
// The 0/14 defaults make InsightCard render the calm "about two weeks of
// mornings…" copy; Reflect doesn't fetch the per-user count itself because
// the surrounding section already says "after about two weeks…" — fetching
// just to refine an already-honest sentence isn't worth the extra round-trip.
const LISTENING_INSIGHT: Insight = {
  kind: 'listening',
  daysOfData: 0,
  minDaysForPattern: 14,
};

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
  const rhythmQuery = useQuery({
    queryKey: queryKeys.reflectRhythm(RHYTHM_WINDOW_DAYS),
    queryFn: () => endpoints.getRhythm(apiClient)(RHYTHM_WINDOW_DAYS),
    staleTime: 10 * 60_000,
  });
  const heatmapQuery = useQuery({
    queryKey: queryKeys.reflectHeatmap(HEATMAP_WINDOW_DAYS),
    queryFn: () => endpoints.getHeatmap(apiClient)(HEATMAP_WINDOW_DAYS),
    staleTime: 10 * 60_000,
  });

  const habitCount = habitsQuery.data?.length ?? 0;
  const insights = insightsQuery.data ?? [];
  const hasPatterns = insights.length > 0;
  const streakHabits = useMemo(
    () =>
      (habitsQuery.data ?? [])
        .filter((h) => h.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 5),
    [habitsQuery.data],
  );

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

      {rhythmQuery.data ? (
        <RhythmSection rhythm={rhythmQuery.data} />
      ) : null}

      {heatmapQuery.data ? (
        <HeatmapSection heatmap={heatmapQuery.data} />
      ) : null}

      {streakHabits.length > 0 ? (
        <StreaksSection habits={streakHabits} />
      ) : null}
    </Screen>
  );
}

function HeatmapSection({ heatmap }: { heatmap: ApiHeatmap }) {
  const hasData = heatmap.days.some((d) => d.totalSlots > 0);
  return (
    <>
      <SectionLabel label="CONSISTENCY" />
      <Card padding="md">
        {!hasData ? (
          <Text className="text-body text-ink-2 font-serif italic">
            The calendar fills in as you check practices off. Quiet days are part of it.
          </Text>
        ) : (
          <>
            <Text className="text-caption text-ink-3 mb-3">
              Last {Math.round(heatmap.windowDays / 7)} weeks
            </Text>
            <ConsistencyHeatmap days={heatmap.days} />
          </>
        )}
      </Card>
    </>
  );
}

function StreaksSection({ habits }: { habits: ApiHabit[] }) {
  return (
    <>
      <SectionLabel label="STREAKS" />
      <View className="gap-2">
        {habits.map((habit) => {
          const HabitIcon = iconFor[habit.icon];
          return (
            <Card key={habit.id} padding="md">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  {HabitIcon ? (
                    <HabitIcon size={16} color={colors.moss} strokeWidth={1.5} />
                  ) : null}
                  <Text className="text-body text-ink font-medium flex-1">
                    {habit.name}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <IconFlame size={14} color={colors.mossLight} strokeWidth={1.5} />
                  <Text className="text-body text-ink-2">
                    {habit.streak} {habit.streak === 1 ? 'day' : 'days'}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    </>
  );
}

function RhythmSection({ rhythm }: { rhythm: ApiRhythm }) {
  const hasData = rhythm.totalSlots > 0;
  // Cadence convention: 0=Mon..6=Sun. JS getDay is 0=Sun..6=Sat.
  const todayIndex = (new Date().getDay() + 6) % 7;
  const overallRate = hasData ? rhythm.totalCompleted / rhythm.totalSlots : 0;
  const bestDay = hasData
    ? [...rhythm.byWeekday].sort((a, b) => b.completionRate - a.completionRate)[0]
    : null;

  return (
    <>
      <SectionLabel label="RHYTHM" />
      <Card padding="md">
        {!hasData ? (
          <Text className="text-body text-ink-2 font-serif italic">
            Your weekly shape appears once a few days of habit history exist.
          </Text>
        ) : (
          <>
            <View className="flex-row items-baseline justify-between mb-3">
              <Text className="text-h3 font-serif text-ink">
                {Math.round(overallRate * 100)}%
              </Text>
              <Text className="text-caption text-ink-3">
                last {Math.round(rhythm.windowDays / 7)} weeks
              </Text>
            </View>
            <RhythmBars byWeekday={rhythm.byWeekday} todayIndex={todayIndex} />
            {bestDay && bestDay.completionRate > 0 ? (
              <Text className="text-caption text-ink-3 mt-3 font-serif italic">
                {bestDay.label}s are when you show up most.
              </Text>
            ) : null}
          </>
        )}
      </Card>
    </>
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
