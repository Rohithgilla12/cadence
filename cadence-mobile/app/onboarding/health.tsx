import {
  IconBolt,
  IconCheck,
  IconHeartbeat,
  IconMoon,
  IconRun,
} from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { apiClient } from '@/lib/client';
import {
  DEFAULT_IMPORT_DAYS,
  getStatus,
  hasHistoricalImportCompleted,
  importHistoricalHealth,
  requestPermissions,
} from '@/lib/health';
import type { HealthAuthStatus, ImportProgress } from '@/lib/health';
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

// Per-screen import state. Drives the progress copy below the scope list.
type ImportState =
  | { phase: 'idle' }
  | { phase: 'running'; progress: ImportProgress }
  | { phase: 'done'; uploaded: number }
  | { phase: 'failed' };

export default function OnboardingHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [status, setStatus] = useState<HealthAuthStatus>('unknown');
  const [busy, setBusy] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ phase: 'idle' });
  const importTriggered = useRef(false);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  // Once HealthKit is authorized, run the retroactive import in the
  // background. We don't block Continue on it — the user can move on
  // and the import finishes silently. If the user has already imported
  // (returning to the screen later) we skip.
  useEffect(() => {
    if (status !== 'authorized' || importTriggered.current) return;
    importTriggered.current = true;
    (async () => {
      if (await hasHistoricalImportCompleted()) {
        setImportState({ phase: 'done', uploaded: 0 });
        return;
      }
      setImportState({
        phase: 'running',
        progress: { read: 0, total: DEFAULT_IMPORT_DAYS },
      });
      try {
        const result = await importHistoricalHealth({
          onProgress: (progress) => setImportState({ phase: 'running', progress }),
        });
        setImportState({ phase: 'done', uploaded: result.uploaded });
        // Fire-and-forget — the correlation worker also runs on a 3am UTC
        // cron, but kicking it off here means a pattern can surface as
        // soon as the user hits Today, instead of waiting until tomorrow.
        void endpoints.computeInsights(apiClient)().catch(() => {});
      } catch {
        setImportState({ phase: 'failed' });
      }
    })();
  }, [status]);

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
          <View className="mt-8">
            <Text className="text-body text-moss font-medium">Connected.</Text>
            <ImportStatus state={importState} />
          </View>
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

// Inline subcomponent — small enough not to warrant its own file, but
// keeping the JSX out of the screen body so the four phases read clearly.
function ImportStatus({ state }: { state: ImportState }) {
  if (state.phase === 'idle') return null;
  if (state.phase === 'running') {
    const { read, total } = state.progress;
    return (
      <View className="mt-3 flex-row items-center gap-2">
        <ActivityIndicator color={colors.moss} />
        <Text className="text-caption text-ink-2">
          Reading the last {total} days from your watch · {read}/{total}
        </Text>
      </View>
    );
  }
  if (state.phase === 'done') {
    return (
      <View className="mt-3 flex-row items-center gap-2">
        <IconCheck size={16} color={colors.moss} strokeWidth={2} />
        <Text className="text-caption text-ink-2">
          {state.uploaded > 0
            ? `Imported ${state.uploaded} days of history.`
            : 'History up to date.'}
        </Text>
      </View>
    );
  }
  return (
    <Text className="mt-3 text-caption text-ink-3">
      Couldn't read your history right now — we'll try again later.
    </Text>
  );
}
