import { IconMinus, IconPlus } from '@tabler/icons-react-native';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/primitives';
import { colors } from '@/theme/tokens';

interface SleepStepperProps {
  value?: number;
  onChange: (value: number | undefined) => void;
}

const STEP = 0.25;
const MIN_HOURS = 0;
const MAX_HOURS = 12;

function formatSleepHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

function StepButton({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 9999,
        borderWidth: 0.5,
        borderColor: colors.hairline2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function SleepStepper({ value, onChange }: SleepStepperProps) {
  function decrement() {
    const current = value ?? 7;
    onChange(Math.max(MIN_HOURS, Math.round((current - STEP) * 4) / 4));
  }

  function increment() {
    const current = value ?? 7;
    onChange(Math.min(MAX_HOURS, Math.round((current + STEP) * 4) / 4));
  }

  return (
    <View className="items-center">
      <View className="flex-row items-center gap-6 py-4">
        <StepButton onPress={decrement} accessibilityLabel="Decrease sleep duration">
          <IconMinus size={18} color={colors.ink2} strokeWidth={1.5} />
        </StepButton>

        <Text
          style={{
            fontFamily: 'Iowan Old Style',
            fontSize: 32,
            lineHeight: 40,
            fontWeight: '500',
            color: value !== undefined ? colors.ink : colors.ink3,
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          {value !== undefined ? formatSleepHours(value) : '—'}
        </Text>

        <StepButton onPress={increment} accessibilityLabel="Increase sleep duration">
          <IconPlus size={18} color={colors.ink2} strokeWidth={1.5} />
        </StepButton>
      </View>

      {value !== undefined && (
        <Button label="Clear" variant="ghost" onPress={() => onChange(undefined)} />
      )}
    </View>
  );
}
