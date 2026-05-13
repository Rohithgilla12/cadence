import {
  IconBike,
  IconHeartbeat,
  IconMoon,
  IconRun,
  IconShoe,
  IconStretching,
  IconSwimming,
  IconTrekking,
} from '@tabler/icons-react-native';
import { TextInput, View, Text, Pressable } from 'react-native';

import { Pill } from '@/components/primitives';
import { colors } from '@/theme/tokens';
import type { ApiHabitSourceLink, HabitTimeWindow } from '@/lib/api/types';

// Catalog of detectable Apple Health activities. Each entry maps a Cadence
// activity slug to a Tabler icon and a sensible default min duration drawn
// from PRD §9 example rules. The slug is what gets persisted on the habit
// and what readDailySummary's WORKOUT_ALIASES recognizes.
interface ActivityOption {
  slug: string;
  label: string;
  kind: 'workout' | 'category';
  defaultMinMinutes: number;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { slug: 'run', label: 'Run', kind: 'workout', defaultMinMinutes: 15, icon: IconRun },
  { slug: 'walk', label: 'Walk', kind: 'workout', defaultMinMinutes: 15, icon: IconShoe },
  { slug: 'cycling', label: 'Cycling', kind: 'workout', defaultMinMinutes: 20, icon: IconBike },
  { slug: 'yoga', label: 'Yoga', kind: 'workout', defaultMinMinutes: 10, icon: IconStretching },
  { slug: 'hike', label: 'Hike', kind: 'workout', defaultMinMinutes: 30, icon: IconTrekking },
  { slug: 'swim', label: 'Swim', kind: 'workout', defaultMinMinutes: 15, icon: IconSwimming },
];

interface SourceLinkPickerProps {
  value: ApiHabitSourceLink | null;
  onChange: (value: ApiHabitSourceLink | null) => void;
}

export function SourceLinkPicker({ value, onChange }: SourceLinkPickerProps) {
  const isLinked = value !== null;

  function selectActivity(option: ActivityOption) {
    onChange({
      provider: 'apple_health',
      kind: option.kind,
      activity: option.slug,
      minMinutes: value?.activity === option.slug && value.minMinutes !== undefined
        ? value.minMinutes
        : option.defaultMinMinutes,
      window: value?.activity === option.slug ? value.window : undefined,
    });
  }

  function updateMinMinutes(raw: string) {
    if (!value) return;
    const numeric = Number(raw.replace(/[^0-9]/g, ''));
    onChange({ ...value, minMinutes: Number.isFinite(numeric) && numeric > 0 ? numeric : undefined });
  }

  function setWindow(window: HabitTimeWindow | undefined) {
    if (!value) return;
    onChange({ ...value, window });
  }

  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <Pill
          label="Manual only"
          selected={!isLinked}
          onPress={() => onChange(null)}
        />
        <Pill
          label="Apple Health"
          selected={isLinked}
          icon={<IconHeartbeat size={11} color={isLinked ? colors.moss : colors.ink2} strokeWidth={1.5} />}
          onPress={() => {
            if (isLinked) return;
            // Default to the first activity. User can refine.
            selectActivity(ACTIVITY_OPTIONS[0]);
          }}
        />
      </View>

      {isLinked && (
        <View className="bg-paper-2 border border-hairline rounded-xl p-3 gap-4">
          <View>
            <Text className="text-eyebrow text-ink-3 uppercase mb-2">ACTIVITY</Text>
            <View className="flex-row flex-wrap gap-2">
              {ACTIVITY_OPTIONS.map((option) => (
                <Pill
                  key={option.slug}
                  label={option.label}
                  selected={value.activity === option.slug}
                  icon={
                    <option.icon
                      size={11}
                      color={value.activity === option.slug ? colors.moss : colors.ink2}
                      strokeWidth={1.5}
                    />
                  }
                  onPress={() => selectActivity(option)}
                />
              ))}
            </View>
          </View>

          <MinMinutesField
            value={value.minMinutes}
            onChange={updateMinMinutes}
          />

          <WindowField window={value.window} onChange={setWindow} />
        </View>
      )}
    </View>
  );
}

function MinMinutesField({
  value,
  onChange,
}: {
  value?: number;
  onChange: (raw: string) => void;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-body text-ink-2">Minimum duration</Text>
      <View className="flex-row items-center gap-1">
        <TextInput
          value={value !== undefined ? String(value) : ''}
          onChangeText={onChange}
          keyboardType="number-pad"
          placeholder="—"
          placeholderTextColor={colors.ink3}
          maxLength={3}
          style={{ width: 44, textAlign: 'right' }}
          className="text-body text-ink font-medium border-b border-hairline pb-0.5"
        />
        <Text className="text-body text-ink-2">min</Text>
      </View>
    </View>
  );
}

const WINDOW_PRESETS: Array<{ label: string; window: HabitTimeWindow | undefined }> = [
  { label: 'Any time', window: undefined },
  { label: 'Morning', window: { start: '05:00', end: '11:00' } },
  { label: 'Evening', window: { start: '18:00', end: '22:00' } },
];

function WindowField({
  window,
  onChange,
}: {
  window?: HabitTimeWindow;
  onChange: (window: HabitTimeWindow | undefined) => void;
}) {
  function isActive(preset: HabitTimeWindow | undefined): boolean {
    if (preset === undefined) return window === undefined;
    if (window === undefined) return false;
    return window.start === preset.start && window.end === preset.end;
  }

  return (
    <View>
      <Text className="text-eyebrow text-ink-3 uppercase mb-2">WHEN IT COUNTS</Text>
      <View className="flex-row flex-wrap gap-2">
        {WINDOW_PRESETS.map((preset) => (
          <Pill
            key={preset.label}
            label={preset.label}
            selected={isActive(preset.window)}
            icon={preset.window ? <IconMoon size={11} color={isActive(preset.window) ? colors.moss : colors.ink2} strokeWidth={1.5} /> : undefined}
            onPress={() => onChange(preset.window)}
          />
        ))}
      </View>
    </View>
  );
}

export { ACTIVITY_OPTIONS };
