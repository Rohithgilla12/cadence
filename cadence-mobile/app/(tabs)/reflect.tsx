import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReflectScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-bg px-[22px]" style={{ paddingTop: insets.top + 20 }}>
      <Text className="font-serif text-h1 text-ink">Reflect</Text>
      <Text className="mt-3 text-body text-ink-2">
        Cadence is listening. Patterns appear after about a week of daily check-ins.
      </Text>
    </View>
  );
}
