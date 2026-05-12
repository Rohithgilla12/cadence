import React from 'react';
import { View, Text } from 'react-native';
import { Card } from '@/components/primitives';
import type { CheckIn, Mood } from '@/types';

interface CheckInRowProps {
  checkIn: CheckIn | null;
}

// Converts a decimal sleep value to a human-readable string.
// 7.5 → "7h 30m", 8.0 → "8h", 7.25 → "7h 15m"
function formatSleepHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

const MOOD_DOTS: Mood[] = [1, 2, 3, 4, 5];

function MoodSection({ mood }: { mood?: Mood }) {
  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">MOOD</Text>
      <View className="flex-row gap-1.5">
        {MOOD_DOTS.map((dotValue) => (
          <View
            key={dotValue}
            style={{ width: 8, height: 8 }}
            className={`rounded-full ${mood !== undefined && dotValue <= mood ? 'bg-moss' : 'bg-paper-2'}`}
          />
        ))}
      </View>
    </View>
  );
}

function SleepSection({ sleepHours }: { sleepHours?: number }) {
  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">SLEEP</Text>
      {sleepHours !== undefined ? (
        <Text className="text-h3 font-serif text-ink">
          {formatSleepHours(sleepHours)}
        </Text>
      ) : (
        <Text className="text-body text-ink-3">—</Text>
      )}
    </View>
  );
}

export function CheckInRow({ checkIn }: CheckInRowProps) {
  const ci = checkIn ?? {};
  return (
    <Card padding="md">
      <View className="flex-row">
        <MoodSection mood={ci.mood} />
        <View className="w-px bg-hairline mx-4" />
        <SleepSection sleepHours={ci.sleepHours} />
      </View>
    </Card>
  );
}
