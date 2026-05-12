import { Pressable, Text, View } from 'react-native';

import type { Mood } from '@/types';
import { colors } from '@/theme/tokens';

interface MoodPickerProps {
  value?: Mood;
  onChange: (value: Mood) => void;
}

const MOOD_ENTRIES: { value: Mood; label: string }[] = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Off' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
];

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <View className="flex-row justify-between">
      {MOOD_ENTRIES.map(({ value: moodValue, label }) => {
        const isSelected = value === moodValue;
        const isFilled = value !== undefined && moodValue <= value;

        return (
          <Pressable
            key={moodValue}
            onPress={() => onChange(moodValue)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={label}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : 1,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <View
              style={{
                width: isSelected ? 22 : 16,
                height: isSelected ? 22 : 16,
                borderRadius: 9999,
                backgroundColor: isFilled ? colors.moss : colors.paper2,
              }}
            />
            <Text
              className="text-caption mt-1.5"
              style={{
                color: isSelected ? colors.moss : colors.ink3,
                fontWeight: isSelected ? '500' : '400',
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
