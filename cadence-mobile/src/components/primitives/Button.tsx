import React from 'react';
import { Pressable, Text, View } from 'react-native';

type ButtonVariant = 'primary' | 'ghost';

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  icon,
  fullWidth = true,
}: ButtonProps) {
  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        className={[
          'py-2.5 items-center',
          fullWidth ? 'self-stretch' : undefined,
          disabled ? 'opacity-50' : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Text className="text-ink-2 text-body-sm">{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={[
        'bg-moss rounded-lg py-3 px-4 items-center flex-row justify-center',
        icon ? 'gap-2' : undefined,
        fullWidth ? 'self-stretch' : undefined,
        disabled ? 'opacity-50' : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      style={({ pressed }) => (pressed && !disabled ? { opacity: 0.9 } : undefined)}
    >
      {icon != null && (
        <View accessibilityElementsHidden>
          {icon}
        </View>
      )}
      <Text className="text-white text-body font-medium">{label}</Text>
    </Pressable>
  );
}
