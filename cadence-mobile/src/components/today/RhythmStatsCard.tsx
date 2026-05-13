import {
  IconActivityHeartbeat,
  IconBolt,
  IconHeart,
  IconRoute,
  IconShoe,
} from '@tabler/icons-react-native';
import { Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';
import type { WorkoutSummary } from '@/lib/health';

interface RhythmStatsCardProps {
  steps?: number;
  activeEnergyKcal?: number;
  distanceMeters?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  workouts: WorkoutSummary[];
}

function formatSteps(steps: number): string {
  return steps.toLocaleString('en-US');
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

interface StatCell {
  label: string;
  value: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}

function Stat({ label, value, icon: Icon }: StatCell) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center gap-1.5 mb-2">
        <Icon size={14} color={colors.ink3} strokeWidth={1.5} />
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

// Renders the cells two at a time with a hairline divider between rows so the
// card looks intentional regardless of how many stats are present.
function StatGrid({ cells }: { cells: StatCell[] }) {
  if (cells.length === 0) return null;
  const rows: StatCell[][] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(cells.slice(i, i + 2));
  }
  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex}>
          {rowIndex > 0 ? <View className="h-px bg-hairline my-3" /> : null}
          <View className="flex-row">
            {row.map((cell, columnIndex) => (
              <View key={cell.label} className="flex-1 flex-row">
                {columnIndex > 0 ? <View className="w-px bg-hairline mx-4" /> : null}
                <Stat {...cell} />
              </View>
            ))}
            {row.length === 1 ? <View className="flex-1" /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function RhythmStatsCard({
  steps,
  activeEnergyKcal,
  distanceMeters,
  restingHeartRate,
  hrvMs,
  workouts,
}: RhythmStatsCardProps) {
  const cells: StatCell[] = [];
  if (steps !== undefined && steps > 0) {
    cells.push({ label: 'STEPS', value: formatSteps(steps), icon: IconShoe });
  }
  if (activeEnergyKcal !== undefined && activeEnergyKcal > 0) {
    cells.push({ label: 'ENERGY', value: `${activeEnergyKcal} kcal`, icon: IconBolt });
  }
  if (distanceMeters !== undefined && distanceMeters > 0) {
    cells.push({ label: 'DISTANCE', value: formatDistance(distanceMeters), icon: IconRoute });
  }
  if (restingHeartRate !== undefined && restingHeartRate > 0) {
    cells.push({ label: 'RESTING HR', value: `${restingHeartRate} bpm`, icon: IconHeart });
  }
  if (hrvMs !== undefined && hrvMs > 0) {
    cells.push({ label: 'HRV', value: `${hrvMs} ms`, icon: IconActivityHeartbeat });
  }

  const hasWorkouts = workouts.length > 0;
  if (cells.length === 0 && !hasWorkouts) return null;

  return (
    <Card padding="md">
      {cells.length > 0 ? <StatGrid cells={cells} /> : null}
      {hasWorkouts ? (
        <View className={cells.length > 0 ? 'mt-4 pt-3 border-t border-hairline' : ''}>
          {workouts.map((workout) => (
            <WorkoutRow key={`${workout.activityName}-${workout.startsAt}`} workout={workout} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
