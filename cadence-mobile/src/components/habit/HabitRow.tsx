import React, { useEffect, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { IconCheck, IconHeartbeat } from '@tabler/icons-react-native';
import { StreakPill } from './StreakPill';
import { iconFor } from '@/lib/mockData';
import { colors } from '@/theme/tokens';
import type { Habit } from '@/types';

interface HabitRowProps {
  habit: Habit;
  onToggle?: (next: boolean) => void | Promise<void>;
}

export function HabitRow({ habit, onToggle }: HabitRowProps) {
  const [isDone, setIsDone] = useState(habit.doneToday);

  // Reconcile local state when server state changes (e.g., after a mutation settles).
  useEffect(() => {
    setIsDone(habit.doneToday);
  }, [habit.doneToday]);

  async function handlePress() {
    const next = !isDone;
    setIsDone(next);
    try {
      await onToggle?.(next);
    } catch {
      setIsDone(!next); // revert on failure — quiet, no alert
    }
  }

  const HabitIcon = iconFor[habit.icon];

  const targetText = habit.target ? `${habit.target.value} ${habit.target.unit}` : '';

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-3 bg-card border border-hairline rounded-xl p-3 active:opacity-90"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isDone }}
      accessibilityLabel={`${habit.name}${isDone ? ', done' : ''}`}
    >
      {/* Check circle */}
      <View
        style={{ width: 24, height: 24 }}
        className={`rounded-full items-center justify-center border ${
          isDone ? 'bg-moss border-moss' : 'border-hairline-2'
        }`}
      >
        {isDone && <IconCheck size={14} color="#FFFFFF" strokeWidth={2} />}
      </View>

      {/* Habit icon + text */}
      <View className="flex-1 flex-row items-center gap-2">
        {HabitIcon && (
          <HabitIcon size={16} color={isDone ? colors.mossLighter : colors.ink2} strokeWidth={1.5} />
        )}
        <View className="flex-1">
          <Text
            className={`text-body text-ink font-medium ${isDone ? 'line-through opacity-60' : ''}`}
          >
            {habit.name}
          </Text>
          {targetText.length > 0 && (
            <Text className="text-caption text-ink-3 mt-0.5">{targetText}</Text>
          )}
          {habit.autoDetected && (
            <View className="flex-row items-center gap-1 mt-0.5">
              <IconHeartbeat size={11} color={colors.moss} strokeWidth={1.5} />
              <Text className="text-caption text-moss">auto-detected from Apple Health</Text>
            </View>
          )}
        </View>
      </View>

      {/* Streak pill */}
      <StreakPill count={habit.streak} />
    </Pressable>
  );
}
