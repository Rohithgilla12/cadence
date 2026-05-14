import { IconChevronRight, IconLeaf } from '@tabler/icons-react-native';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';

interface RecoveryCardProps {
  missedCount: number;
  onPress: () => void;
}

// Quiet "you're back" entry that surfaces when one or more habits have a
// broken streak and are old enough to have actually been done yesterday.
// Voice per PRD §3 + §20: no shame, no "rebuilding", no fail copy.
export function RecoveryCard({ missedCount, onPress }: RecoveryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Recovery moment, ${missedCount} ${missedCount === 1 ? 'practice' : 'practices'}`}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
    >
      <Card padding="md">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1">
            <IconLeaf size={16} color={colors.moss} strokeWidth={1.5} />
            <View className="flex-1">
              <Text className="text-body text-ink font-medium">Welcome back</Text>
              <Text className="text-caption text-ink-3 mt-0.5">
                {missedCount === 1
                  ? 'One quiet practice from yesterday — tag it, then keep going.'
                  : `${missedCount} quiet practices from yesterday — tag them, then keep going.`}
              </Text>
            </View>
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.5} />
        </View>
      </Card>
    </Pressable>
  );
}
