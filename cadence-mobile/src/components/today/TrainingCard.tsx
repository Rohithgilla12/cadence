import { IconChevronRight, IconRoute } from '@tabler/icons-react-native';
import { Pressable, Text, View } from 'react-native';

import { WeekBars } from '@/components/charts';
import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';

interface TrainingCardProps {
  weekTotalMeters: number;
  weekDailyMeters: ReadonlyArray<number>;
  todayWeekdayIndex: number;
  runCountThisWeek: number;
  onPress: () => void;
}

function formatKm(meters: number): string {
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// PRD §7 "training summary card for runners" — a quiet, tappable surface on
// Today that shows this-week's mileage and the same week-bars used on the
// Running screen, so the two surfaces feel like one continuous thought.
export function TrainingCard({
  weekTotalMeters,
  weekDailyMeters,
  todayWeekdayIndex,
  runCountThisWeek,
  onPress,
}: TrainingCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open Running"
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
    >
      <Card padding="md">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <IconRoute size={16} color={colors.moss} strokeWidth={1.5} />
            <Text className="text-eyebrow text-ink-3 uppercase">THIS WEEK</Text>
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.5} />
        </View>
        <View className="flex-row items-baseline justify-between mb-3">
          <Text className="text-h2 font-serif text-ink">
            {weekTotalMeters > 0 ? formatKm(weekTotalMeters) : '0 km'}
          </Text>
          <Text className="text-caption text-ink-3">
            {runCountThisWeek} {runCountThisWeek === 1 ? 'run' : 'runs'}
          </Text>
        </View>
        <WeekBars
          values={weekDailyMeters.map((meters) => meters / 1000)}
          todayIndex={todayWeekdayIndex}
        />
      </Card>
    </Pressable>
  );
}
