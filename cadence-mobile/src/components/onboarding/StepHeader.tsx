import { Text, View } from 'react-native';

interface StepHeaderProps {
  title: string;
  subtitle?: string;
}

export function StepHeader({ title, subtitle }: StepHeaderProps) {
  return (
    <View>
      <Text className="font-serif text-h1 text-ink">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-body text-ink-2">{subtitle}</Text>
      ) : null}
    </View>
  );
}
