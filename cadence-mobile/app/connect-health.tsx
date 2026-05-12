import { IconArrowLeft, IconBolt, IconHeartbeat, IconMoon, IconRun } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/primitives';
import { getStatus, requestPermissions } from '@/lib/health';
import { colors, screenPaddingX } from '@/theme/tokens';
import type { HealthAuthStatus } from '@/lib/health';

interface Scope {
  label: string;
  icon: React.ReactNode;
}

const SCOPES: Scope[] = [
  { label: 'Sleep duration and stages',           icon: <IconMoon size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Steps and active energy',             icon: <IconBolt size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Workouts (runs, walks, yoga, swim)',  icon: <IconRun size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Resting heart rate and HRV',          icon: <IconHeartbeat size={18} color={colors.moss} strokeWidth={1.5} /> },
];

export default function ConnectHealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<HealthAuthStatus>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  async function handleConnect() {
    if (status === 'unavailable') return;
    setBusy(true);
    try {
      const nextStatus = await requestPermissions();
      setStatus(nextStatus);
      if (nextStatus === 'authorized') {
        // Brief moment to let the success sink in, then route home.
        setTimeout(() => router.back(), 600);
      }
    } catch (err) {
      Alert.alert('Could not connect', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      className="flex-1 bg-bg"
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: screenPaddingX,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="self-start py-2 -ml-2 px-2"
      >
        <IconArrowLeft size={22} color={colors.ink} strokeWidth={1.5} />
      </Pressable>

      <View className="mt-8">
        <Text className="text-h1 font-serif text-ink">Connect Apple Health</Text>
        <Text className="mt-3 text-body text-ink-2">
          Cadence reads what your phone already knows so we can show you what moves your rhythm. Nothing leaves this device.
        </Text>
      </View>

      <View className="mt-8 gap-3">
        {SCOPES.map((scope) => (
          <View key={scope.label} className="flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-moss-bg items-center justify-center">
              {scope.icon}
            </View>
            <Text className="text-body text-ink flex-1">{scope.label}</Text>
          </View>
        ))}
      </View>

      <View className="flex-1" />

      {status === 'authorized' ? (
        <View className="items-center mb-4">
          <Text className="text-body text-moss font-medium">Connected</Text>
        </View>
      ) : null}

      {status === 'unavailable' ? (
        <Text className="text-caption text-ink-3 mb-3 text-center">
          Apple Health is iOS-only. Health Connect for Android is coming soon.
        </Text>
      ) : null}

      <Button
        label={status === 'authorized' ? 'Done' : busy ? 'Connecting…' : 'Connect Apple Health'}
        onPress={status === 'authorized' ? () => router.back() : handleConnect}
        disabled={busy || status === 'unavailable'}
      />
    </View>
  );
}
