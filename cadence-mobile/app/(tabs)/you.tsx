import {
  IconBell,
  IconChevronRight,
  IconFileText,
  IconHeartbeat,
  IconLifebuoy,
  IconLogout,
  IconMoon,
  IconShield,
  IconTrash,
} from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HealthConnectCard } from '@/components/health/HealthConnectCard';
import { StravaConnectCard } from '@/components/health/StravaConnectCard';
import { Screen, SectionLabel } from '@/components/layout';
import { Avatar, Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/client';
import { getStatus } from '@/lib/health';
import {
  DEFAULT_MAX_HR,
  DEFAULT_QUIET_HOURS,
  clearMaxHr,
  clearQuietHours,
  getMaxHr,
  getQuietHours,
  setMaxHr,
  setQuietHours,
  type QuietHours,
} from '@/lib/settings';
import { colors } from '@/theme/tokens';
import type { HealthAuthStatus } from '@/lib/health';

export default function YouScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient]);

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });
  const maxHrQuery = useQuery({
    queryKey: ['settings-max-hr'],
    queryFn: getMaxHr,
  });
  const quietHoursQuery = useQuery({
    queryKey: ['settings-quiet-hours'],
    queryFn: getQuietHours,
  });

  const deleteAccountMutation = useMutation({
    mutationFn: endpoints.deleteMe(apiClient),
    onSuccess: async () => {
      try {
        const { track, reset } = await import('@/lib/analytics');
        track({ name: 'account_deleted' });
        await reset();
      } catch {
        // Analytics never blocks UX.
      }
      // Drop the retroactive-import flag so the next install (or re-sign-in
      // with a new account) reimports the user's HealthKit history rather
      // than skipping. Best-effort — failure here doesn't block sign-out.
      try {
        const { clearHistoricalImport } = await import('@/lib/health');
        await clearHistoricalImport();
      } catch {
        // Ignore — re-import on next onboarding handles this.
      }
      // Server is gone — sign out the client so the next launch doesn't try
      // to use a stale Firebase token against a deleted user row.
      try {
        await signOut();
      } catch {
        // signOut failure here doesn't matter — server-side row is already gone.
      }
    },
    onError: (err) => {
      Alert.alert('Could not delete', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'This wipes your habits, logs, health summaries, check-ins, circle memberships, and reactions. There is no undo.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => deleteAccountMutation.mutate(),
        },
      ],
    );
  }

  const [healthStatus, setHealthStatus] = useState<HealthAuthStatus>('unknown');
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getStatus().then((nextStatus) => {
        if (!cancelled) setHealthStatus(nextStatus);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSignOut() {
    Alert.alert('Sign out of Cadence?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            Alert.alert('Sign-out failed', err instanceof Error ? err.message : 'Unknown error');
          }
        },
      },
    ]);
  }

  if (meQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      </Screen>
    );
  }

  const me = meQuery.data;
  const displayName = me?.displayName || user?.displayName || 'Quiet traveler';
  const email = me?.email || user?.email || '';

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text className="font-serif text-h1 text-ink">You</Text>

      <Pressable
        onPress={() => router.push('/profile-edit')}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        style={({ pressed }) => (pressed ? { opacity: 0.9 } : undefined)}
        className="mt-6"
      >
        <View className="flex-row items-center gap-3">
          <Avatar name={displayName} size={72} />
          <View className="flex-1">
            <Text className="text-h3 text-ink font-medium">{displayName}</Text>
            {email ? <Text className="text-body-sm text-ink-2 mt-0.5">{email}</Text> : null}
          </View>
          <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.5} />
        </View>
      </Pressable>

      <SectionLabel label="INTEGRATIONS" />
      <View className="gap-2">
        <HealthConnectCard status={healthStatus} />
        <StravaConnectCard />
      </View>

      <SectionLabel label="PERSONAL" />
      <View className="gap-2">
        <MaxHrRow
          savedValue={maxHrQuery.data ?? null}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['settings-max-hr'] });
          }}
        />
        <QuietHoursRow
          savedValue={quietHoursQuery.data ?? null}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['settings-quiet-hours'] });
          }}
        />
      </View>

      <SectionLabel label="NOTIFICATIONS" />
      <PushTestRow />

      <SectionLabel label="LEGAL" />
      <View className="gap-2">
        <LegalRow
          label="Privacy"
          icon={<IconShield size={18} color={colors.ink2} strokeWidth={1.5} />}
          onPress={() => router.push('/legal/privacy')}
        />
        <LegalRow
          label="Terms"
          icon={<IconFileText size={18} color={colors.ink2} strokeWidth={1.5} />}
          onPress={() => router.push('/legal/terms')}
        />
        <LegalRow
          label="Support"
          icon={<IconLifebuoy size={18} color={colors.ink2} strokeWidth={1.5} />}
          onPress={() => router.push('/legal/support')}
        />
      </View>

      <SectionLabel label="ACCOUNT" />
      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        className="flex-row items-center gap-3 py-4"
      >
        <IconLogout size={18} color={colors.ink2} strokeWidth={1.5} />
        <Text className="text-body text-ink-2">Sign out</Text>
      </Pressable>
      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        disabled={deleteAccountMutation.isPending}
        className="flex-row items-center gap-3 py-4 border-t border-hairline"
      >
        <IconTrash size={18} color={colors.clayText} strokeWidth={1.5} />
        <Text className="text-body" style={{ color: colors.clayText }}>
          {deleteAccountMutation.isPending ? 'Deleting…' : 'Delete account'}
        </Text>
      </Pressable>

      <Text className="text-micro text-ink-3 mt-8 text-center">Cadence · v0.1.0</Text>
    </Screen>
  );
}

function PushTestRow() {
  const testMutation = useMutation({
    mutationFn: async () => {
      const { requestAndRegister, sendTest } = await import('@/lib/push');
      // Make sure permission + token are current before sending — useful if
      // the user toggled notifications in Settings after first launch.
      const result = await requestAndRegister();
      if (!result.granted) {
        throw new Error('Notifications are off in iOS Settings.');
      }
      return sendTest();
    },
    onSuccess: (result) => {
      if (result.sent === 0) {
        Alert.alert(
          'No devices to send to',
          'Re-open the app once after granting notification permission, then try again.',
        );
        return;
      }
      Alert.alert(
        'Sent',
        `Pushed to ${result.sent} ${result.sent === 1 ? 'device' : 'devices'}. Pull down the banner from Notification Center to see it.`,
      );
    },
    onError: (err) => {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  return (
    <Card padding="md">
      <View className="flex-row items-center gap-2 flex-1">
        <IconBell size={16} color={colors.moss} strokeWidth={1.5} />
        <View className="flex-1">
          <Text className="text-body text-ink">Test notifications</Text>
          <Text className="text-caption text-ink-3 mt-0.5">
            Sends a hello push to verify everything works.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => testMutation.mutate()}
        disabled={testMutation.isPending}
        accessibilityRole="button"
        accessibilityLabel="Send a test push"
        style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}
        className="self-start mt-3"
      >
        <Text className="text-body text-moss font-medium">
          {testMutation.isPending ? 'Sending…' : 'Send test'}
        </Text>
      </Pressable>
    </Card>
  );
}

function LegalRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 bg-card border border-hairline rounded-xl p-3 active:opacity-90"
    >
      {icon}
      <Text className="flex-1 text-body text-ink">{label}</Text>
      <IconChevronRight size={16} color={colors.ink3} strokeWidth={1.5} />
    </Pressable>
  );
}

interface QuietHoursRowProps {
  savedValue: QuietHours | null;
  onSaved: () => void;
}

function QuietHoursRow({ savedValue, onSaved }: QuietHoursRowProps) {
  const [editing, setEditing] = useState(false);
  const initial = savedValue ?? DEFAULT_QUIET_HOURS;
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);

  const saveMutation = useMutation({
    mutationFn: () => setQuietHours({ start, end }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });
  const resetMutation = useMutation({
    mutationFn: clearQuietHours,
    onSuccess: () => {
      setStart(DEFAULT_QUIET_HOURS.start);
      setEnd(DEFAULT_QUIET_HOURS.end);
      setEditing(false);
      onSaved();
    },
  });

  const display = savedValue ?? null;
  const displayText = display ? `${display.start} — ${display.end}` : 'Off';

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <IconMoon size={16} color={colors.moss} strokeWidth={1.5} />
          <View className="flex-1">
            <Text className="text-body text-ink">Quiet hours</Text>
            <Text className="text-caption text-ink-3 mt-0.5">
              No notifications during this window.
            </Text>
          </View>
        </View>
        {!editing ? (
          <Pressable
            onPress={() => {
              setStart(initial.start);
              setEnd(initial.end);
              setEditing(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit quiet hours"
          >
            <Text className="text-body text-moss font-medium">{displayText}</Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View className="mt-4 gap-3">
          <View className="flex-row gap-3 items-center">
            <Text className="text-caption text-ink-3 w-12">Start</Text>
            <TextInput
              value={start}
              onChangeText={setStart}
              placeholder="21:00"
              placeholderTextColor={colors.ink3}
              maxLength={5}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              className="text-body text-ink border-b border-hairline pb-1 px-1"
              style={{ minWidth: 60 }}
            />
          </View>
          <View className="flex-row gap-3 items-center">
            <Text className="text-caption text-ink-3 w-12">End</Text>
            <TextInput
              value={end}
              onChangeText={setEnd}
              placeholder="08:00"
              placeholderTextColor={colors.ink3}
              maxLength={5}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              className="text-body text-ink border-b border-hairline pb-1 px-1"
              style={{ minWidth: 60 }}
            />
          </View>
          <View className="flex-row gap-4 mt-2">
            <Pressable
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save quiet hours"
            >
              <Text className="text-body text-moss font-medium">
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setEditing(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text className="text-body text-ink-2">Cancel</Text>
            </Pressable>
            {savedValue ? (
              <Pressable
                onPress={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Turn off quiet hours"
                className="ml-auto"
              >
                <Text className="text-body text-ink-3">Turn off</Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="text-caption text-ink-3 font-serif italic">
            HH:MM in 24-hour format. Push notifications haven't shipped yet — this
            preference is saved for when they do.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

interface MaxHrRowProps {
  savedValue: number | null;
  onSaved: () => void;
}

// Inline editor — tapping the value reveals the input + Save/Cancel/Reset
// actions. Avoids a sub-screen for a single integer field.
function MaxHrRow({ savedValue, onSaved }: MaxHrRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    savedValue != null ? String(savedValue) : String(DEFAULT_MAX_HR),
  );

  const saveMutation = useMutation({
    mutationFn: async (raw: string) => {
      const numeric = Number(raw);
      await setMaxHr(numeric);
    },
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const resetMutation = useMutation({
    mutationFn: clearMaxHr,
    onSuccess: () => {
      setDraft(String(DEFAULT_MAX_HR));
      setEditing(false);
      onSaved();
    },
  });

  return (
    <Card padding="md">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <IconHeartbeat size={16} color={colors.moss} strokeWidth={1.5} />
          <View className="flex-1">
            <Text className="text-body text-ink">Max heart rate</Text>
            <Text className="text-caption text-ink-3 mt-0.5">
              Personalizes HR zones on every run.
            </Text>
          </View>
        </View>
        {!editing ? (
          <Pressable
            onPress={() => {
              setDraft(savedValue != null ? String(savedValue) : String(DEFAULT_MAX_HR));
              setEditing(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit max heart rate"
          >
            <Text className="text-body text-moss font-medium">
              {savedValue != null ? `${savedValue} bpm` : `${DEFAULT_MAX_HR} bpm`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View className="mt-4">
          <View className="flex-row items-baseline gap-2">
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
              style={{ minWidth: 60 }}
              className="text-h3 font-serif text-ink border-b border-hairline pb-1"
            />
            <Text className="text-body text-ink-2">bpm</Text>
          </View>
          <View className="flex-row gap-4 mt-4">
            <Pressable
              onPress={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Save"
            >
              <Text className="text-body text-moss font-medium">
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setEditing(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text className="text-body text-ink-2">Cancel</Text>
            </Pressable>
            {savedValue != null ? (
              <Pressable
                onPress={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Reset to default"
                className="ml-auto"
              >
                <Text className="text-body text-ink-3">Reset</Text>
              </Pressable>
            ) : null}
          </View>
          <Text className="text-caption text-ink-3 mt-3 font-serif italic">
            Common formulas: 220 minus your age, or a hard-effort peak from your last race.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
