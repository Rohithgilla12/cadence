import React from 'react';
import { View, Text } from 'react-native';
import { IconFlame } from '@tabler/icons-react-native';
import { colors } from '@/theme/tokens';

interface StreakPillProps {
  count: number;
}

// Returns null when count is 0 — no empty pill visible on the row.
export function StreakPill({ count }: StreakPillProps) {
  if (count === 0) return null;

  return (
    <View className="bg-sand rounded-full px-2 py-0.5 flex-row items-center gap-1">
      <IconFlame size={11} color={colors.sandText} strokeWidth={1.5} />
      <Text className="text-micro text-sand-text">{count}</Text>
    </View>
  );
}
