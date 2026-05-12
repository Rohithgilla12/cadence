import { Pressable, Text, View } from 'react-native';

type Provider = 'apple' | 'google';

interface SignInButtonProps {
  provider: Provider;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

export function SignInButton({ provider, label, icon, onPress, disabled }: SignInButtonProps) {
  const visual =
    provider === 'apple'
      ? 'bg-ink border border-ink'
      : 'bg-card border border-hairline-2';
  const textColor = provider === 'apple' ? 'text-white' : 'text-ink';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      className={`${visual} rounded-lg py-3.5 px-4 flex-row items-center justify-center gap-2 ${disabled ? 'opacity-50' : ''}`}
      style={({ pressed }) => (pressed && !disabled ? { opacity: 0.9 } : undefined)}
    >
      {icon}
      <Text className={`${textColor} text-body font-medium`}>{label}</Text>
    </Pressable>
  );
}
