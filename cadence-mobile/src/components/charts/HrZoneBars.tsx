import { Text, View } from 'react-native';

interface HrZoneBarsProps {
  // Seconds spent in each zone, Z1..Z5.
  secondsInZone: ReadonlyArray<number>;
}

const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;
// PRD design system: no rainbow heat-map (would read as gamification). Use a
// monochrome moss ramp where higher intensity = deeper moss. Same family,
// no new tokens.
const ZONE_BG_CLASSES = [
  'bg-moss-bg-2',   // Z1 — pale
  'bg-moss-lighter', // Z2
  'bg-moss-light',   // Z3
  'bg-moss',         // Z4
  'bg-moss',         // Z5 (same as Z4 — only the bar fills tell zone apart, copy says Z5)
] as const;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes - hours * 60;
  if (remMinutes === 0) return `${hours}h`;
  return `${hours}h ${remMinutes}m`;
}

// Horizontal bars per zone. Quiet — no axis ticks, no percentages, just
// label + duration. Reads as "you spent most of this run in Z3-Z4."
export function HrZoneBars({ secondsInZone }: HrZoneBarsProps) {
  const max = Math.max(1, ...secondsInZone);

  return (
    <View className="gap-2">
      {ZONE_LABELS.map((label, index) => {
        const seconds = secondsInZone[index] ?? 0;
        const widthPercent = (seconds / max) * 100;
        return (
          <View key={label} className="flex-row items-center gap-3">
            <Text style={{ width: 24 }} className="text-eyebrow text-ink-3 uppercase">
              {label}
            </Text>
            <View className="flex-1 h-4 bg-paper-2 rounded-full overflow-hidden">
              {seconds > 0 ? (
                <View
                  style={{ width: `${Math.max(2, widthPercent)}%` }}
                  className={`h-full rounded-full ${ZONE_BG_CLASSES[index]}`}
                />
              ) : null}
            </View>
            <Text style={{ width: 56 }} className="text-caption text-ink-2 text-right">
              {seconds === 0 ? '—' : formatDuration(seconds)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
