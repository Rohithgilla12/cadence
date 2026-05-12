import { View } from 'react-native';

import { Pill } from '@/components/primitives';
import type { ApiTimeOfDay } from '@/lib/api/types';

const OPTIONS: { value: ApiTimeOfDay; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'evening', label: 'Evening' },
  { value: 'anytime', label: 'Anytime' },
];

interface TimeOfDayPickerProps {
  value: ApiTimeOfDay;
  onChange: (value: ApiTimeOfDay) => void;
}

export function TimeOfDayPicker({ value, onChange }: TimeOfDayPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <Pill
          key={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}
