import { IconArrowLeft } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, screenPaddingX } from '@/theme/tokens';

interface LegalScreenLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

// Shared chrome for Privacy / Terms / Support. Plain content surfaces —
// no cards, no chart noise. Voice stays calm per PRD §20.
export function LegalScreenLayout({ title, subtitle, children }: LegalScreenLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: screenPaddingX,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="self-start py-2 -ml-2 px-2 mb-2"
          hitSlop={8}
        >
          <IconArrowLeft size={22} color={colors.ink} strokeWidth={1.5} />
        </Pressable>
        <Text className="font-serif text-h1 text-ink">{title}</Text>
        {subtitle ? (
          <Text className="font-serif italic text-body text-ink-2 mt-2">{subtitle}</Text>
        ) : null}
        <View className="mt-6 gap-5">{children}</View>
      </ScrollView>
    </View>
  );
}

export function LegalHeading({ children }: { children: string }) {
  return (
    <Text className="text-eyebrow text-ink-3 uppercase mt-2">{children}</Text>
  );
}

export function LegalParagraph({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-body text-ink-2 leading-relaxed">{children}</Text>
  );
}
