import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/primitives';
import { Screen, SectionLabel } from '@/components/layout';
import { HabitRow } from '@/components/habit';
import { InsightCard } from '@/components/insight';
import { WeekStrip, CheckInRow, RhythmStatsCard } from '@/components/today';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { detectFromSummary, getStatus, readDailySummary } from '@/lib/health';
import { colors } from '@/theme/tokens';
import { mockInsight, mockWeek } from '@/lib/mockData';
import type { ApiHabit } from '@/lib/api/types';
import type { Habit } from '@/types';

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

  const healthStatusQuery = useQuery({
    queryKey: ['health-status'],
    queryFn: getStatus,
    staleTime: 60_000,
  });

  const dailySummaryQuery = useQuery({
    queryKey: ['health-summary', todayIso],
    queryFn: () => readDailySummary(new Date()),
    enabled: healthStatusQuery.data === 'authorized',
    staleTime: 5 * 60_000,
  });

  const habits = useMemo(() => habitsQuery.data?.map(toHabit) ?? [], [habitsQuery.data]);
  const doneCount = useMemo(() => habits.filter((h) => h.doneToday).length, [habits]);

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
        <WeekStrip days={mockWeek} />
      </View>

      <View className="mt-6">
        <InsightCard insight={mockInsight} />
      </View>

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
      />

      {dailySummaryQuery.data ? (
        <View className="mt-3">
          <RhythmStatsCard
            steps={dailySummaryQuery.data.steps}
            activeEnergyKcal={dailySummaryQuery.data.activeEnergyKcal}
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
