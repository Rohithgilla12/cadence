import {
  IconBolt,
  IconHeartbeat,
  IconMoon,
  IconRun,
} from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { getStatus, requestPermissions } from '@/lib/health';
import type { HealthAuthStatus } from '@/lib/health';
import { colors, screenPaddingX } from '@/theme/tokens';

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

export default function OnboardingHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [status, setStatus] = useState<HealthAuthStatus>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  async function handleConnect() {
    setBusy(true);
    try {
      const next = await requestPermissions();
      setStatus(next);
    } catch (err) {
      Alert.alert('Could not connect', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function handleContinue() {
    router.push('/onboarding/practices');
  }

  const primaryLabel =
    status === 'authorized'
      ? 'Continue'
      : busy
        ? 'Connecting…'
        : 'Connect Apple Health';

  const onPrimary = status === 'authorized' ? handleContinue : handleConnect;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={3} total={4} />
        <View className="mt-6">
          <StepHeader
            title="Connect Apple Health"
            subtitle="Cadence reads what your phone already knows so we can show you what moves your rhythm. Nothing leaves this device."
          />
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

        {status === 'authorized' ? (
          <Text className="mt-8 text-body text-moss font-medium">Connected.</Text>
        ) : null}

        {status === 'unavailable' || Platform.OS !== 'ios' ? (
          <Text className="mt-8 text-caption text-ink-3">
            Apple Health is iOS-only. Health Connect for Android is coming soon.
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: screenPaddingX,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          borderTopWidth: 0.5,
          borderTopColor: colors.hairline,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          label={primaryLabel}
          variant="primary"
          fullWidth
          disabled={busy}
          onPress={onPrimary}
        />
        <View className="mt-2">
          <Button label="Skip for now" variant="ghost" onPress={handleContinue} />
        </View>
      </View>
    </View>
  );
}
