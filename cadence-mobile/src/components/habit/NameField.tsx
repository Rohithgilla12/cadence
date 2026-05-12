import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { colors } from '@/theme/tokens';

interface NameFieldProps {
  value: string;
  onChangeText: (text: string) => void;
}

// Borderless serif input — the habit name reads like a journal entry, not a
// form field. The hairline below brightens to moss-light on focus.
export function NameField({ value, onChangeText }: NameFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <TextInput
        autoFocus
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="What would you like to practice?"
        placeholderTextColor={colors.ink3}
        returnKeyType="done"
        maxLength={60}
        accessibilityLabel="Habit name"
        style={{
          fontFamily: 'Iowan Old Style',
          fontSize: 22,
          lineHeight: 30,
          color: colors.ink,
          paddingVertical: 12,
        }}
      />
      <View
        style={{
          height: focused ? 1 : 0.5,
          backgroundColor: focused ? colors.mossLight : colors.hairline2,
        }}
      />
    </View>
  );
}
