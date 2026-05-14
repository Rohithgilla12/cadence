import { IconMail } from '@tabler/icons-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import { LegalHeading, LegalParagraph, LegalScreenLayout } from '@/components/legal';
import { colors } from '@/theme/tokens';

const SUPPORT_EMAIL = 'support@cadence.gilla.fun';

export default function SupportScreen() {
  function openEmail() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Cadence support`).catch(() => {});
  }
  return (
    <LegalScreenLayout title="Support" subtitle="A human reads every message.">
      <LegalParagraph>
        Cadence is a solo project being built in the open. If something's broken,
        confusing, or just doesn't feel right, write — I want to hear it.
      </LegalParagraph>

      <LegalHeading>BEFORE YOU WRITE</LegalHeading>
      <LegalParagraph>
        A few common ones that aren't bugs:
      </LegalParagraph>
      <View className="gap-3">
        <LegalParagraph>
          • Patterns won't appear for the first two weeks — the engine waits until
          there's enough data to bet on a relationship.
        </LegalParagraph>
        <LegalParagraph>
          • A missed day doesn't shame you. The recovery moment is there if you
          want to tag what got in the way, but you don't have to.
        </LegalParagraph>
        <LegalParagraph>
          • Apple Health data lives on your phone. If you connect on a new device,
          history from before the connection is gone until the watch re-syncs.
        </LegalParagraph>
      </View>

      <LegalHeading>WRITE</LegalHeading>
      <Pressable
        onPress={openEmail}
        accessibilityRole="button"
        accessibilityLabel="Email support"
        style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
        className="flex-row items-center gap-2 self-start"
      >
        <IconMail size={16} color={colors.moss} strokeWidth={1.5} />
        <Text className="text-body text-moss font-medium">{SUPPORT_EMAIL}</Text>
      </Pressable>
    </LegalScreenLayout>
  );
}
