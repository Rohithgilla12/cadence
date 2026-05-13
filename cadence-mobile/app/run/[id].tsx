import { IconArrowLeft, IconRoute } from '@tabler/icons-react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { HrZoneBars } from '@/components/charts';
import { Screen, SectionLabel } from '@/components/layout';
import { Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { readDailySummary, readHeartRateForWorkout, readWorkoutsRange } from '@/lib/health';
import { formatKm, formatPace } from '@/lib/running';
import { colors } from '@/theme/tokens';

// Run detail uses the workout's start-time ISO string as its route id since
// HealthKit's UUIDs aren't always stable across iCloud sync. We re-query the
// workouts for that day and find the one with the matching startsAt — single
// source of truth (the watch).
export default function RunDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const startsAtIso = String(params.id ?? '');

  const day = useMemo(() => {
    if (!startsAtIso) return new Date();
    return new Date(startsAtIso);
  }, [startsAtIso]);

  const dayBounds = useMemo(() => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return { start, end };
  }, [day]);

  const dayIso = useMemo(() => {
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  }, [day]);

  const workoutsQuery = useQuery({
    queryKey: ['health-workouts-day', dayIso],
    queryFn: () => readWorkoutsRange(dayBounds.start, dayBounds.end),
    staleTime: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ['health-summary', dayIso],
    queryFn: () => readDailySummary(day),
    staleTime: 5 * 60_000,
  });

  const checkInQuery = useQuery({
    queryKey: queryKeys.checkIn(dayIso),
    queryFn: () => endpoints.getCheckIn(apiClient)(dayIso),
  });

  const run = useMemo(
    () => workoutsQuery.data?.find((workout) => workout.startsAt === startsAtIso),
    [workoutsQuery.data, startsAtIso],
  );

  // Pull heart-rate samples once we've resolved the run's bounds. Enabled
  // gate keeps the bridge call off when there's no run to query against.
  const hrQuery = useQuery({
    queryKey: ['health-hr-zones', run?.startsAt, run?.endsAt],
    queryFn: () =>
      run ? readHeartRateForWorkout(run.startsAt, run.endsAt) : Promise.resolve(null),
    enabled: !!run,
    staleTime: 60 * 60_000,
  });

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

      {workoutsQuery.isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : !run ? (
        <View className="mt-4">
          <Text className="text-body text-ink-2">This run is no longer in Apple Health.</Text>
        </View>
      ) : (
        <>
          <View className="flex-row items-center gap-2 mt-2">
            <IconRoute size={20} color={colors.moss} strokeWidth={1.5} />
            <Text className="text-h2 font-serif text-ink">{run.activityName}</Text>
          </View>
          <Text className="text-caption text-ink-3 mt-1">{formatDateLong(run.startsAt)}</Text>

          <View className="mt-6 flex-row">
            <StatBlock label="DISTANCE" value={run.distanceMeters !== undefined ? formatKm(run.distanceMeters) : '—'} />
            <View className="w-px bg-hairline mx-4" />
            <StatBlock label="TIME" value={`${run.durationMinutes} min`} />
            <View className="w-px bg-hairline mx-4" />
            <StatBlock label="PACE" value={formatPace(run.durationMinutes, run.distanceMeters)} />
          </View>

          {hrQuery.data ? (
            <>
              <SectionLabel label="HEART RATE" />
              <Card padding="md">
                <View className="flex-row mb-4">
                  <StatBlock label="AVG" value={`${hrQuery.data.averageBpm} bpm`} />
                  <View className="w-px bg-hairline mx-4" />
                  <StatBlock label="MAX" value={`${hrQuery.data.maxBpm} bpm`} />
                  <View className="w-px bg-hairline mx-4" />
                  <StatBlock label="MIN" value={`${hrQuery.data.minBpm} bpm`} />
                </View>
                <HrZoneBars secondsInZone={hrQuery.data.secondsInZone} />
                <Text className="text-caption text-ink-3 mt-3 font-serif italic">
                  Zones assume a max of 190 bpm. Set your own in You → Settings (soon).
                </Text>
              </Card>
            </>
          ) : null}

          <SectionLabel label="THAT MORNING" />
          <Card padding="md">
            <View className="gap-3">
              <ContextRow
                label="Sleep"
                value={
                  summaryQuery.data?.sleepHours !== undefined
                    ? formatSleepHours(summaryQuery.data.sleepHours)
                    : '—'
                }
              />
              <ContextRow
                label="Resting HR"
                value={
                  summaryQuery.data?.restingHeartRate !== undefined
                    ? `${summaryQuery.data.restingHeartRate} bpm`
                    : '—'
                }
              />
              <ContextRow
                label="HRV"
                value={
                  summaryQuery.data?.hrvMs !== undefined ? `${summaryQuery.data.hrvMs} ms` : '—'
                }
              />
              <ContextRow
                label="Mood"
                value={
                  checkInQuery.data?.mood !== undefined ? `${checkInQuery.data.mood} / 5` : '—'
                }
              />
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">{label}</Text>
      <Text className="text-h3 font-serif text-ink">{value}</Text>
    </View>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between">
      <Text className="text-body text-ink-2">{label}</Text>
      <Text className="text-body text-ink font-medium">{value}</Text>
    </View>
  );
}

function formatDateLong(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatSleepHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}
