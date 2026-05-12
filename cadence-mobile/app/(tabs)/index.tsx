import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Screen, SectionLabel } from '@/components/layout';
import { Button } from '@/components/primitives';
import { HabitRow } from '@/components/habit';
import { InsightCard } from '@/components/insight';
import { WeekStrip, CheckInRow } from '@/components/today';
import { mockHabits, mockWeek, mockInsight, mockCheckIn } from '@/lib/mockData';

function resolveGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function TodayScreen() {
  // Tracks each habit's done state independently, keyed by habit id.
  const [doneByHabitId, setDoneByHabitId] = useState<Record<string, boolean>>(
    () => Object.fromEntries(mockHabits.map((habit) => [habit.id, habit.done]))
  );

  function handleToggle(habitId: string, next: boolean) {
    setDoneByHabitId((previous) => ({ ...previous, [habitId]: next }));
  }

  const doneCount = useMemo(
    () => Object.values(doneByHabitId).filter(Boolean).length,
    [doneByHabitId]
  );

  const greeting = resolveGreeting();
  const dateLabel = formatTodayDate();

  return (
    <Screen scroll>
      {/* Header */}
      <View>
        <Text className="text-body-sm text-ink-3">{greeting}</Text>
        <Text className="text-h1 font-serif text-ink mt-0.5">{dateLabel}</Text>
      </View>

      {/* Week strip */}
      <View className="mt-6">
        <WeekStrip days={mockWeek} />
      </View>

      {/* Daily insight */}
      <View className="mt-6">
        <InsightCard insight={mockInsight} />
      </View>

      {/* Habits section */}
      <SectionLabel label={`HABITS · ${doneCount} OF ${mockHabits.length}`} />
      <View className="gap-2">
        {mockHabits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={{ ...habit, done: doneByHabitId[habit.id] ?? habit.done }}
            onToggle={(next) => handleToggle(habit.id, next)}
          />
        ))}
      </View>

      {/* Check-in section */}
      <SectionLabel label="TODAY" />
      <CheckInRow checkIn={mockCheckIn} />

      {/* Add habit — gentle, no flourish */}
      <View className="mt-6">
        <Button label="Add a habit" variant="ghost" onPress={() => {}} />
      </View>
    </Screen>
  );
}
