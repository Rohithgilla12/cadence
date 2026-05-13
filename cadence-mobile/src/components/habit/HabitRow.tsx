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
  // When present, tapping the row body navigates to habit detail and the
  // checkmark circle becomes its own tap zone for toggling. Mirrors the
  // iOS Reminders interaction model — discoverable without a long-press.
  // When omitted, the whole row toggles (legacy behaviour).
  onOpen?: () => void;
}

export function HabitRow({ habit, onToggle, onOpen }: HabitRowProps) {
  const [isDone, setIsDone] = useState(habit.doneToday);

  // Reconcile local state when server state changes (e.g., after a mutation settles).
  useEffect(() => {
    setIsDone(habit.doneToday);
  }, [habit.doneToday]);

  async function handleToggle() {
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

  const outerProps = onOpen
    ? {
        onPress: onOpen,
        accessibilityRole: 'button' as const,
        accessibilityLabel: `${habit.name}, open detail`,
      }
    : {
        onPress: handleToggle,
        accessibilityRole: 'checkbox' as const,
        accessibilityState: { checked: isDone },
        accessibilityLabel: `${habit.name}${isDone ? ', done' : ''}`,
      };

  const checkCircle = (
    <View
      style={{ width: 24, height: 24 }}
      className={`rounded-full items-center justify-center border ${
        isDone ? 'bg-moss border-moss' : 'border-hairline-2'
      }`}
    >
      {isDone && <IconCheck size={14} color="#FFFFFF" strokeWidth={2} />}
    </View>
  );

  return (
    <Pressable
      {...outerProps}
      className="flex-row items-center gap-3 bg-card border border-hairline rounded-xl p-3 active:opacity-90"
    >
      {onOpen ? (
        <Pressable
          onPress={handleToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDone }}
          accessibilityLabel={isDone ? 'Mark not done' : 'Mark done'}
        >
          {checkCircle}
        </Pressable>
      ) : (
        checkCircle
      )}

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

      <StreakPill count={habit.streak} />
    </Pressable>
  );
}
