import { Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '@/components/primitives';
import type { SleepStages } from '@/lib/health';
import type { CheckIn, Mood } from '@/types';

interface CheckInRowProps {
  checkIn: CheckIn | null;
  // Provided when Apple Health is connected and has sleep data for today.
  // Used only when checkIn.sleepHours is undefined — the user's manual log
  // is always canonical (CLAUDE.md "never auto-uncheck").
  healthSleepHours?: number;
  healthSleepStages?: SleepStages;
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
  stages?: SleepStages;
}

function formatStageHours(minutes: number): string {
  const wholeHours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes - wholeHours * 60);
  if (wholeHours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${remainingMinutes}m`;
}

function stagesCaption(stages: SleepStages): string | null {
  // Only render the breakdown when the watch actually staged the sleep —
  // older devices emit only "asleepUnspecified" and per-stage is useless.
  const stageParts: string[] = [];
  if (stages.deepMinutes > 0) stageParts.push(`Deep ${formatStageHours(stages.deepMinutes)}`);
  if (stages.remMinutes > 0) stageParts.push(`REM ${formatStageHours(stages.remMinutes)}`);
  if (stages.coreMinutes > 0) stageParts.push(`Core ${formatStageHours(stages.coreMinutes)}`);
  if (stageParts.length === 0) return null;
  return stageParts.join(' · ');
}

function SleepSection({ manualHours, fallbackHours, stages }: SleepSectionProps) {
  const hours = manualHours ?? fallbackHours;
  const fromHealth = manualHours === undefined && fallbackHours !== undefined;
  const breakdown = fromHealth && stages ? stagesCaption(stages) : null;

  return (
    <View className="flex-1">
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">SLEEP</Text>
      {hours !== undefined ? (
        <>
          <Text className="text-h3 font-serif text-ink">{formatSleepHours(hours)}</Text>
          {breakdown ? (
            <Text className="text-caption text-ink-3 mt-1">{breakdown}</Text>
          ) : fromHealth ? (
            <Text className="text-caption text-ink-3 mt-1">from Apple Health</Text>
          ) : null}
        </>
      ) : (
        <Text className="text-body text-ink-3">—</Text>
      )}
    </View>
  );
}

export function CheckInRow({ checkIn, healthSleepHours, healthSleepStages }: CheckInRowProps) {
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
          <SleepSection
            manualHours={ci.sleepHours}
            fallbackHours={healthSleepHours}
            stages={healthSleepStages}
          />
        </View>
      </Pressable>
    </Card>
  );
}
