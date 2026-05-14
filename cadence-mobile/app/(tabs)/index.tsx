import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/primitives';
import { Screen, SectionLabel } from '@/components/layout';
import { HabitRow } from '@/components/habit';
import { track } from '@/lib/analytics';
import { InsightCard } from '@/components/insight';
import {
  CheckInRow,
  RecoveryCard,
  RhythmStatsCard,
  TrainingCard,
  WeekStrip,
} from '@/components/today';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { detectFromSummary, getStatus, readDailySummary, readWorkoutsRange } from '@/lib/health';
import { syncWidgetData } from '@/lib/widgets';
import {
  dailyMetersForWeek,
  filterRuns,
  startOfWeek,
  todayWeekdayIndex as currentWeekdayIndex,
} from '@/lib/running';
import { colors } from '@/theme/tokens';
import { buildWeekDays } from '@/lib/week';
import type { ApiHabit } from '@/lib/api/types';
import type { Habit, Insight } from '@/types';

// 14 days covers this week plus last week so the strip stays accurate
// when the heatmap is computed on a 7-day rolling basis. Cheap enough
// to fetch on every Today open; cached briefly so back-and-forth tab
// switches don't re-fire it.
const WEEK_HEATMAP_WINDOW_DAYS = 14;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function toHabit(api: ApiHabit): Habit {
  return {
    id: api.id,
    name: api.name,
    icon: api.icon,
    timeOfDay: api.timeOfDay,
    target: api.target,
    doneToday: api.doneToday,
    streak: api.streak,
    autoDetected: api.autoDetected,
  };
}

// Module-scoped so it survives StrictMode double-mounts and remounts in the
// same session. Cleared on full app reload (which is fine — the server-side
// log is the source of truth).
const detectionFiredFor = new Set<string>();

// Module-scoped fingerprint cache for daily-summary uploads. Each entry is
// `${date}:${json}` — same content for the same day = no-op. A failed upload
// removes its entry so we retry on the next render that produces the same
// summary.
const uploadedFingerprints = new Set<string>();

export default function TodayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });

  const toggleMutation = useMutation({
    mutationFn: (habitId: string) => endpoints.toggleHabit(apiClient)(habitId),
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits });
      const previous = queryClient.getQueryData<ApiHabit[]>(queryKeys.habits);
      queryClient.setQueryData<ApiHabit[]>(queryKeys.habits, (current) =>
        current?.map((h) =>
          h.id === habitId ? { ...h, doneToday: !h.doneToday } : h,
        ),
      );
      return { previous };
    },
    onError: (_err, _habitId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.habits, context.previous);
    },
    onSuccess: (updated, habitId) => {
      queryClient.setQueryData<ApiHabit[]>(queryKeys.habits, (current) =>
        current?.map((h) => (h.id === habitId ? updated : h)),
      );
      track({ name: 'habit_toggled', done: updated.doneToday, source: 'manual' });
    },
  });

  const todayIso = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const checkInQuery = useQuery({
    queryKey: queryKeys.checkIn(todayIso),
    queryFn: () => endpoints.getCheckIn(apiClient)(todayIso),
  });

  // Today's rotated insight per PRD §8. Server stamps shown_at on read, so
  // the next call advances rotation. When data isn't strong enough yet the
  // server returns null and we show 'Cadence is listening' — never fabricate.
  const insightQuery = useQuery({
    queryKey: queryKeys.insightToday,
    queryFn: endpoints.getInsightToday(apiClient),
    staleTime: 60 * 60_000,
  });
  const insightResponse = insightQuery.data;
  const insight: Insight = insightResponse?.insight
    ? { kind: 'pattern', renderedText: insightResponse.insight.renderedText }
    : {
        kind: 'listening',
        daysOfData: insightResponse?.daysOfData ?? 0,
        minDaysForPattern: insightResponse?.minDaysForPattern ?? 14,
      };

  const healthStatusQuery = useQuery({
    queryKey: ['health-status'],
    queryFn: getStatus,
    staleTime: 60_000,
  });

  // Per-day completion for the current week strip. Heatmap is the same
  // surface Reflect uses; we just take a smaller window. 5-minute stale
  // window so back-and-forth tab switches don't re-fire it.
  const weekHeatmapQuery = useQuery({
    queryKey: queryKeys.reflectHeatmap(WEEK_HEATMAP_WINDOW_DAYS),
    queryFn: () => endpoints.getHeatmap(apiClient)(WEEK_HEATMAP_WINDOW_DAYS),
    staleTime: 5 * 60_000,
  });

  const weekDays = useMemo(
    () => buildWeekDays(new Date(), weekHeatmapQuery.data?.days),
    [weekHeatmapQuery.data, todayIso],
  );

  const dailySummaryQuery = useQuery({
    queryKey: ['health-summary', todayIso],
    queryFn: () => readDailySummary(new Date()),
    enabled: healthStatusQuery.data === 'authorized',
    staleTime: 5 * 60_000,
  });

  // PRD §9 — sync on-device daily summaries to the server so the correlation
  // worker has data to chew on. Hash-deduped per day so a re-render doesn't
  // re-PUT the same numbers. Errors are quiet: a transient network blip
  // shouldn't show an alert; tomorrow's query will catch up.
  useEffect(() => {
    const summary = dailySummaryQuery.data;
    if (!summary) return;
    const payload = {
      sleepHours: summary.sleepHours,
      sleepDeepMinutes: summary.sleepStages?.deepMinutes,
      sleepRemMinutes: summary.sleepStages?.remMinutes,
      sleepCoreMinutes: summary.sleepStages?.coreMinutes,
      steps: summary.steps,
      distanceMeters: summary.distanceMeters,
      activeEnergyKcal: summary.activeEnergyKcal,
      restingHeartRate: summary.restingHeartRate,
      hrvMs: summary.hrvMs,
      source: 'apple_health' as const,
    };
    const fingerprint = JSON.stringify(payload);
    const dedupeKey = `${summary.date}:${fingerprint}`;
    if (uploadedFingerprints.has(dedupeKey)) return;
    uploadedFingerprints.add(dedupeKey);
    endpoints
      .putDailySummary(apiClient)(summary.date, payload)
      .catch(() => uploadedFingerprints.delete(dedupeKey));
  }, [dailySummaryQuery.data]);

  // Fetch a 6-week window of workouts. The training card shows mileage for
  // this week, but uses the broader window to decide whether to render at
  // all — a quiet week shouldn't hide the entry point if the user has runs
  // in their history. Matches the Running screen's TREND_WEEKS so the two
  // queries share a cache key when ranges align.
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const recentWindowStart = useMemo(() => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() - 5 * 7);
    return start;
  }, [weekStart]);
  const recentWorkoutsQuery = useQuery({
    queryKey: ['health-workouts-recent', recentWindowStart.toISOString()],
    queryFn: () => readWorkoutsRange(recentWindowStart, new Date()),
    enabled: healthStatusQuery.data === 'authorized',
    staleTime: 5 * 60_000,
  });
  const recentRuns = useMemo(
    () => filterRuns(recentWorkoutsQuery.data ?? []),
    [recentWorkoutsQuery.data],
  );
  const weekStartMs = weekStart.getTime();
  const weekRuns = useMemo(
    () => recentRuns.filter((run) => new Date(run.startsAt).getTime() >= weekStartMs),
    [recentRuns, weekStartMs],
  );
  const weekDailyMeters = useMemo(
    () => dailyMetersForWeek(weekRuns, weekStart),
    [weekRuns, weekStart],
  );
  const weekTotalMeters = useMemo(
    () => weekDailyMeters.reduce((a, b) => a + b, 0),
    [weekDailyMeters],
  );
  // Card stays visible whenever the user has a running history in our window,
  // even if this week is empty. That preserves the entry to /running on
  // recovery weeks.
  const hasAnyRuns = recentRuns.length > 0;

  const habits = useMemo(() => habitsQuery.data?.map(toHabit) ?? [], [habitsQuery.data]);
  const doneCount = useMemo(() => habits.filter((h) => h.doneToday).length, [habits]);

  // Recovery candidates: habits with broken streaks that have existed long
  // enough to actually have been done yesterday. Surfacing this on Today
  // gives the user a quiet way to acknowledge a missed day per PRD §3
  // principle 2 — coming back, not rebuilding.
  const recoveryCount = useMemo(() => {
    if (!habitsQuery.data) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return habitsQuery.data.filter((h) => {
      if (h.streak > 0) return false;
      const created = new Date(h.createdAt).getTime();
      return now - created > dayMs;
    }).length;
  }, [habitsQuery.data]);

  // Mirror what's on screen into the iOS Home Screen / Lock Screen widgets.
  // The sync layer dedupes by fingerprint so this can fire freely on every
  // habit toggle. Until we have real per-day completion data the week strip
  // honestly shows past days as quiet (see buildWeekDots).
  useEffect(() => {
    if (!habitsQuery.data) return;
    syncWidgetData({ habits, insight });
  }, [habits, insight, habitsQuery.data]);

  // PRD §9 — Auto-detection. When Apple Health has fresh data and a habit has
  // a sourceLink rule that matches today's workouts, fire a server toggle with
  // source=apple_health so the habit pre-checks. The backend's toggle handler
  // enforces "never auto-uncheck a manually-logged habit", and we gate each
  // habit-id+today combination with `detectionFiredFor` so a re-render doesn't
  // re-trigger it.
  const todayKeyRef = useRef(todayIso);
  if (todayKeyRef.current !== todayIso) {
    todayKeyRef.current = todayIso;
    detectionFiredFor.clear();
  }
  const autodetectMutation = useMutation({
    mutationFn: (habitId: string) =>
      endpoints.toggleHabit(apiClient)(habitId, 'apple_health'),
    onSuccess: (updated, habitId) => {
      queryClient.setQueryData<ApiHabit[]>(queryKeys.habits, (current) =>
        current?.map((h) => (h.id === habitId ? updated : h)),
      );
      track({ name: 'habit_toggled', done: updated.doneToday, source: 'apple_health' });
    },
  });
  useEffect(() => {
    const summary = dailySummaryQuery.data;
    if (!summary) return;
    const apiHabits = habitsQuery.data;
    if (!apiHabits) return;
    for (const habit of apiHabits) {
      if (!habit.sourceLink) continue;
      if (habit.doneToday) continue;
      const dedupeKey = `${habit.id}:${todayIso}`;
      if (detectionFiredFor.has(dedupeKey)) continue;
      const { matched } = detectFromSummary(habit.sourceLink, summary);
      if (!matched) continue;
      detectionFiredFor.add(dedupeKey);
      autodetectMutation.mutate(habit.id);
    }
  }, [dailySummaryQuery.data, habitsQuery.data, todayIso, autodetectMutation]);

  return (
    <Screen scroll>
      <View>
        <Text className="text-body-sm text-ink-3">{greeting()}</Text>
        <Text className="text-h1 font-serif text-ink mt-0.5">{todayLabel()}</Text>
      </View>

      <View className="mt-6">
        <WeekStrip days={weekDays} />
      </View>

      <View className="mt-6">
        <InsightCard insight={insight} />
      </View>

      {recoveryCount > 0 ? (
        <View className="mt-3">
          <RecoveryCard
            missedCount={recoveryCount}
            onPress={() => router.push('/recovery')}
          />
        </View>
      ) : null}

      {hasAnyRuns ? (
        <View className="mt-3">
          <TrainingCard
            weekTotalMeters={weekTotalMeters}
            weekDailyMeters={weekDailyMeters}
            todayWeekdayIndex={currentWeekdayIndex()}
            runCountThisWeek={weekRuns.length}
            lastRunAt={recentRuns[0]?.startsAt}
            onPress={() => router.push('/running')}
          />
        </View>
      ) : null}

      <SectionLabel label={`HABITS · ${doneCount} OF ${habits.length}`} />

      {habitsQuery.isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      ) : habits.length === 0 ? (
        <View className="py-6">
          <Text className="text-body text-ink-2">
            No habits yet. Add one to begin — two is plenty for the first week.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={async () => {
                await toggleMutation.mutateAsync(habit.id);
              }}
              onOpen={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
            />
          ))}
        </View>
      )}

      <SectionLabel label="TODAY" />
      <CheckInRow
        checkIn={checkInQuery.data ? {
          mood: checkInQuery.data.mood,
          sleepHours: checkInQuery.data.sleepHours,
        } : null}
        healthSleepHours={dailySummaryQuery.data?.sleepHours}
        healthSleepStages={dailySummaryQuery.data?.sleepStages}
      />

      {dailySummaryQuery.data ? (
        <View className="mt-3">
          <RhythmStatsCard
            steps={dailySummaryQuery.data.steps}
            activeEnergyKcal={dailySummaryQuery.data.activeEnergyKcal}
            distanceMeters={dailySummaryQuery.data.distanceMeters}
            restingHeartRate={dailySummaryQuery.data.restingHeartRate}
            hrvMs={dailySummaryQuery.data.hrvMs}
            workouts={dailySummaryQuery.data.workouts}
          />
        </View>
      ) : null}

      <View className="mt-6">
        <Button
          label="Add a practice"
          variant="ghost"
          onPress={() => router.push('/add-habit')}
        />
      </View>
    </Screen>
  );
}
