import { IconBolt, IconRoute, IconShoe } from '@tabler/icons-react-native';
import { Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';
import type { WorkoutSummary } from '@/lib/health';

interface RhythmStatsCardProps {
  steps?: number;
  activeEnergyKcal?: number;
  workouts: WorkoutSummary[];
}

function formatSteps(steps: number): string {
  return steps.toLocaleString('en-US');
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km >= 10) return `${km.toFixed(1)} km`;
  return `${km.toFixed(2)} km`;
}

function StatColumn({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-1.5 mb-2">
        {icon}
        <Text className="text-eyebrow text-ink-3 uppercase">{label}</Text>
      </View>
      <Text className="text-h3 font-serif text-ink">{value}</Text>
    </View>
  );
}

function WorkoutRow({ workout }: { workout: WorkoutSummary }) {
  const parts: string[] = [`${workout.durationMinutes} min`];
  if (workout.distanceMeters !== undefined && workout.distanceMeters > 0) {
    parts.push(formatDistance(workout.distanceMeters));
  }

  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-row items-center gap-2">
        <IconRoute size={16} color={colors.moss} strokeWidth={1.5} />
        <Text className="text-body text-ink">{workout.activityName}</Text>
      </View>
      <Text className="text-body-sm text-ink-2">{parts.join(' · ')}</Text>
    </View>
  );
}

export function RhythmStatsCard({
  steps,
  activeEnergyKcal,
  workouts,
}: RhythmStatsCardProps) {
  const hasSteps = steps !== undefined && steps > 0;
  const hasEnergy = activeEnergyKcal !== undefined && activeEnergyKcal > 0;
  const hasWorkouts = workouts.length > 0;

  if (!hasSteps && !hasEnergy && !hasWorkouts) return null;

  return (
    <Card padding="md">
      {hasSteps || hasEnergy ? (
        <View className="flex-row">
          {hasSteps ? (
            <StatColumn
              label="STEPS"
              value={formatSteps(steps)}
              icon={<IconShoe size={14} color={colors.ink3} strokeWidth={1.5} />}
            />
          ) : null}
          {hasSteps && hasEnergy ? <View className="w-px bg-hairline mx-4" /> : null}
          {hasEnergy ? (
            <StatColumn
              label="ENERGY"
              value={`${activeEnergyKcal} kcal`}
              icon={<IconBolt size={14} color={colors.ink3} strokeWidth={1.5} />}
            />
          ) : null}
        </View>
      ) : null}

      {hasWorkouts ? (
        <View className={(hasSteps || hasEnergy) ? 'mt-4 pt-3 border-t border-hairline' : ''}>
          {workouts.map((workout) => (
            <WorkoutRow key={`${workout.activityName}-${workout.startsAt}`} workout={workout} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
