import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface PillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

export function Pill({ label, selected = false, onPress, icon }: PillProps) {
  const containerClassName = [
    'rounded-full px-3 py-1.5 flex-row items-center gap-1',
    selected
      ? 'bg-moss-bg border border-moss-light'
      : 'bg-transparent border border-hairline-2',
  ].join(' ');

  const textClassName = selected ? 'text-micro text-moss' : 'text-micro text-ink-2';

  const content = (
    <>
      {icon != null && (
        <View accessibilityElementsHidden>
          {icon}
        </View>
      )}
      <Text className={textClassName}>{label}</Text>
    </>
  );

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        className={containerClassName}
      >
        {content}
      </Pressable>
    );
  }

  return <View className={containerClassName}>{content}</View>;
}
