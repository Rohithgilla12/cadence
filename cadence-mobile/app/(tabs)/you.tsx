import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-bg px-[22px]" style={{ paddingTop: insets.top + 20 }}>
      <Text className="font-serif text-h1 text-ink">You</Text>
      <Text className="mt-3 text-body text-ink-2">
        Profile, integrations, and exports land here.
      </Text>
    </View>
  );
}
