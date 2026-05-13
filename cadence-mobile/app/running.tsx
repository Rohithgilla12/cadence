import { IconArrowLeft, IconRoute } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { TrendLine, WeekBars } from '@/components/charts';
import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { readWorkoutsRange } from '@/lib/health';
import {
  dailyMetersForWeek,
  filterRuns,
  formatKm,
  formatPace,
  startOfWeek,
  todayWeekdayIndex,
  totalMeters,
  weeklyTotalsBack,
} from '@/lib/running';
import { colors } from '@/theme/tokens';

// Render up to 6 weeks of running history. Apple Health on a fresh watch
// rarely has more than that without manual logging; longer windows risk
// noisy trend lines that imply trends where there are none.
const TREND_WEEKS = 6;

export default function RunningScreen() {
  const router = useRouter();

  const range = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = startOfWeek(now);
    start.setDate(start.getDate() - (TREND_WEEKS - 1) * 7);
    return { start, end };
  }, []);

  const workoutsQuery = useQuery({
    queryKey: ['health-workouts', range.start.toISOString(), range.end.toISOString()],
    queryFn: () => readWorkoutsRange(range.start, range.end),
    staleTime: 60_000,
  });

  const runs = useMemo(() => filterRuns(workoutsQuery.data ?? []), [workoutsQuery.data]);
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const weekDailyMeters = useMemo(() => dailyMetersForWeek(runs, weekStart), [runs, weekStart]);
  const weekTotalMeters = useMemo(() => weekDailyMeters.reduce((a, b) => a + b, 0), [weekDailyMeters]);
  const weekTotalKm = weekTotalMeters / 1000;
  const trend = useMemo(() => weeklyTotalsBack(runs, now, TREND_WEEKS), [runs, now]);
  const trendValues = useMemo(() => trend.map((bucket) => bucket.meters / 1000), [trend]);
  const recentRuns = useMemo(
    () =>
      [...runs].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [runs],
  );

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

      <Text className="font-serif text-h1 text-ink">Running</Text>
      <Text className="font-serif italic text-body text-ink-2 mt-2">
        Weekly rhythm. Quiet trends.
      </Text>

      <View className="mt-6">
        <Card padding="md">
          <View className="flex-row items-baseline justify-between mb-3">
            <Text className="text-eyebrow text-ink-3 uppercase">THIS WEEK</Text>
            <Text className="text-caption text-ink-3">
              {recentRuns.filter((run) => new Date(run.startsAt) >= weekStart).length} runs
            </Text>
          </View>
          <Text className="text-h2 font-serif text-ink mb-4">
            {weekTotalKm > 0 ? formatKm(weekTotalMeters) : '0 km'}
          </Text>
          <WeekBars
            values={weekDailyMeters.map((meters) => meters / 1000)}
            todayIndex={todayWeekdayIndex(now)}
          />
        </Card>
      </View>

      {trend.length > 1 && trendValues.some((v) => v > 0) ? (
        <View className="mt-3">
          <Card padding="md">
            <View className="flex-row items-baseline justify-between mb-2">
              <Text className="text-eyebrow text-ink-3 uppercase">TREND</Text>
              <Text className="text-caption text-ink-3">{TREND_WEEKS} weeks</Text>
            </View>
            <TrendLine
              values={trendValues}
              endLabels={[`${TREND_WEEKS - 1}w ago`, 'this wk']}
            />
          </Card>
        </View>
      ) : null}

      <SectionLabel label="RECENT RUNS" />

      {workoutsQuery.isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : recentRuns.length === 0 ? (
        <Card padding="md">
          <Text className="text-body text-ink-2">
            No runs in the last {TREND_WEEKS} weeks. Go on one — Cadence is listening.
          </Text>
        </Card>
      ) : (
        <View className="gap-2">
          {recentRuns.map((run) => (
            <RunListCard
              key={run.startsAt}
              startsAt={run.startsAt}
              activityName={run.activityName}
              durationMinutes={run.durationMinutes}
              distanceMeters={run.distanceMeters}
              onPress={() => router.push({
                pathname: '/run/[id]',
                params: { id: run.startsAt },
              })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

interface RunListCardProps {
  startsAt: string;
  activityName: string;
  durationMinutes: number;
  distanceMeters?: number;
  onPress: () => void;
}

function formatRunDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (sameDay) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function RunListCard({ startsAt, durationMinutes, distanceMeters, onPress }: RunListCardProps) {
  const distance = distanceMeters !== undefined ? formatKm(distanceMeters) : '—';
  const pace = formatPace(durationMinutes, distanceMeters);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Run on ${formatRunDate(startsAt)}, ${distance}`}
      className="bg-card border border-hairline rounded-xl p-4 active:opacity-90"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center gap-2">
          <IconRoute size={16} color={colors.moss} strokeWidth={1.5} />
          <Text className="text-body text-ink font-medium">{formatRunDate(startsAt)}</Text>
        </View>
        <Text className="text-caption text-ink-3">
          {new Date(startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
      <View className="flex-row items-baseline gap-4 mt-3">
        <Text className="text-h3 font-serif text-ink">{distance}</Text>
        <Text className="text-body-sm text-ink-2">{durationMinutes} min</Text>
        <Text className="text-body-sm text-ink-2">{pace}</Text>
      </View>
    </Pressable>
  );
}
