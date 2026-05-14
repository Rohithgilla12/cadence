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

import { JournalHeader, PageChapter } from '@/components/onboarding';
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
  { label: 'Sleep — duration and stages',          icon: <IconMoon size={16} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Steps and active energy',              icon: <IconBolt size={16} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Workouts — runs, walks, yoga, swim',   icon: <IconRun size={16} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Resting heart rate and HRV',           icon: <IconHeartbeat size={16} color={colors.moss} strokeWidth={1.5} /> },
];

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
          paddingTop: insets.top + 28,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 48,
        }}
      >
        <PageChapter current={3} total={4} />
        <View className="mt-10">
          <JournalHeader
            eyebrow="What your phone already knows"
            title="Connect Apple Health."
            subtitle="Cadence reads the rollups your watch has been writing all year — sleep, HRV, runs. Raw samples stay on this device."
          />
        </View>

        <View className="mt-10 gap-4">
          {SCOPES.map((scope) => (
            <View key={scope.label} className="flex-row items-center gap-3">
              {scope.icon}
              <Text className="text-body text-ink-2 flex-1">{scope.label}</Text>
            </View>
          ))}
        </View>

        {status === 'authorized' ? (
          <View className="mt-10">
            <View className="flex-row items-center gap-2">
              <IconCheck size={14} color={colors.moss} strokeWidth={2} />
              <Text
                className="text-eyebrow text-moss uppercase"
                style={{ letterSpacing: 2.5 }}
              >
                Connected
              </Text>
            </View>
            <ImportStatus state={importState} />
          </View>
        ) : null}

        {status === 'unavailable' || Platform.OS !== 'ios' ? (
          <Text className="mt-10 text-body-sm text-ink-3 italic">
            Apple Health is iOS-only. Health Connect for Android is coming.
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

function ImportStatus({ state }: { state: ImportState }) {
  if (state.phase === 'idle') return null;
  if (state.phase === 'running') {
    const { read, total } = state.progress;
    return (
      <View className="mt-4 flex-row items-center gap-2">
        <ActivityIndicator color={colors.moss} />
        <Text className="text-body-sm text-ink-2">
          Reading the last {total} days · {read}/{total}
        </Text>
      </View>
    );
  }
  if (state.phase === 'done') {
    return (
      <Text className="mt-3 text-body-sm text-ink-2 font-serif italic">
        {state.uploaded > 0
          ? `Brought ${state.uploaded} days of history forward.`
          : 'History is already up to date.'}
      </Text>
    );
  }
  return (
    <Text className="mt-3 text-body-sm text-ink-3">
      Couldn't read your history right now — we'll try again later.
    </Text>
  );
}
