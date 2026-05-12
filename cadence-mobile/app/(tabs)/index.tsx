import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/primitives';
import { Screen, SectionLabel } from '@/components/layout';
import { HabitRow } from '@/components/habit';
import { InsightCard } from '@/components/insight';
import { WeekStrip, CheckInRow } from '@/components/today';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
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

export default function TodayScreen() {
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

  const habits = useMemo(() => habitsQuery.data?.map(toHabit) ?? [], [habitsQuery.data]);
  const doneCount = useMemo(() => habits.filter((h) => h.doneToday).length, [habits]);

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
      <CheckInRow checkIn={checkInQuery.data ? {
        mood: checkInQuery.data.mood,
        sleepHours: checkInQuery.data.sleepHours,
      } : null} />

      <View className="mt-6">
        <Button label="Add a habit" variant="ghost" onPress={() => {}} />
      </View>
    </Screen>
  );
}
