import React from 'react';
import { Text, View } from 'react-native';
import { dustToneFor } from '@/theme/tokens';

interface AvatarProps {
  name: string;
  size?: 26 | 32 | 40 | 72;
}

// Font sizes per DS §8: 26→11, 32→13, 40→15, 72→24
const fontSizeForSize: Record<26 | 32 | 40 | 72, number> = {
  26: 11,
  32: 13,
  40: 15,
  72: 24,
};

export function Avatar({ name, size = 32 }: AvatarProps) {
  const tone = dustToneFor(name);
  const initial = name.trimStart().charAt(0).toUpperCase();
  const fontSize = fontSizeForSize[size];

  return (
    <View
      style={{ width: size, height: size, backgroundColor: tone.bg }}
      className="rounded-full items-center justify-center"
      accessibilityLabel={name}
      accessibilityRole="image"
    >
      <Text style={{ color: tone.text, fontSize, fontWeight: '500' }}>
        {initial}
      </Text>
    </View>
  );
}
