import { Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '@/components/primitives';
import type { CheckIn, Mood } from '@/types';

interface CheckInRowProps {
  checkIn: CheckIn | null;
  // Provided when Apple Health is connected and has sleep data for today.
  // Used only when checkIn.sleepHours is undefined — the user's manual log
  // is always canonical (CLAUDE.md "never auto-uncheck").
  healthSleepHours?: number;
}

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

interface SleepSectionProps {
  manualHours?: number;
  fallbackHours?: number;
}

function SleepSection({ manualHours, fallbackHours }: SleepSectionProps) {
  const hours = manualHours ?? fallbackHours;
  const fromHealth = manualHours === undefined && fallbackHours !== undefined;

  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">SLEEP</Text>
      {hours !== undefined ? (
        <>
          <Text className="text-h3 font-serif text-ink">{formatSleepHours(hours)}</Text>
          {fromHealth ? (
            <Text className="text-caption text-ink-3 mt-1">from Apple Health</Text>
          ) : null}
        </>
      ) : (
        <Text className="text-body text-ink-3">—</Text>
      )}
    </View>
  );
}

export function CheckInRow({ checkIn, healthSleepHours }: CheckInRowProps) {
  const ci = checkIn ?? {};
  const router = useRouter();

  return (
    <Card padding="md">
      <Pressable
        onPress={() => router.push({ pathname: '/check-in' })}
        accessibilityRole="button"
        accessibilityLabel="Edit today's check-in"
        style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
      >
        <View className="flex-row">
          <MoodSection mood={ci.mood} />
          <View className="w-px bg-hairline mx-4" />
          <SleepSection manualHours={ci.sleepHours} fallbackHours={healthSleepHours} />
        </View>
      </Pressable>
    </Card>
  );
}
