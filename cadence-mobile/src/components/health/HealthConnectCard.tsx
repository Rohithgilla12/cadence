import { IconChevronRight, IconHeartHandshake } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';
import type { HealthAuthStatus } from '@/lib/health';

interface HealthConnectCardProps {
  status: HealthAuthStatus;
}

function statusLabel(status: HealthAuthStatus): string {
  switch (status) {
    case 'authorized': return 'Connected';
    case 'denied': return 'Not granted';
    case 'unavailable': return 'iOS only';
    default: return 'Not connected';
  }
}

export function HealthConnectCard({ status }: HealthConnectCardProps) {
  const router = useRouter();
  const isUnavailable = status === 'unavailable';
  return (
    <Card padding="md">
      <Pressable
        onPress={() => !isUnavailable && router.push('/connect-health')}
        disabled={isUnavailable}
        accessibilityRole="button"
        accessibilityLabel="Apple Health connection"
        className="flex-row items-center gap-3"
        style={({ pressed }) => (pressed && !isUnavailable ? { opacity: 0.9 } : undefined)}
      >
        <View className="w-9 h-9 rounded-full bg-moss-bg items-center justify-center">
          <IconHeartHandshake size={18} color={colors.moss} strokeWidth={1.5} />
        </View>
        <View className="flex-1">
          <Text className="text-body text-ink font-medium">Apple Health</Text>
          <Text className="text-caption text-ink-3 mt-0.5">{statusLabel(status)}</Text>
        </View>
        {!isUnavailable && (
          <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.5} />
        )}
      </Pressable>
    </Card>
  );
}
