import { IconChevronRight, IconHeartbeat, IconLogout } from '@tabler/icons-react-native';
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
import { Screen, SectionLabel } from '@/components/layout';
import { Avatar, Card } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/client';
import { getStatus } from '@/lib/health';
import { DEFAULT_MAX_HR, clearMaxHr, getMaxHr, setMaxHr } from '@/lib/settings';
import { colors } from '@/theme/tokens';
import type { HealthAuthStatus } from '@/lib/health';

export default function YouScreen() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });
  const maxHrQuery = useQuery({
    queryKey: ['settings-max-hr'],
    queryFn: getMaxHr,
  });

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
    <Screen>
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
      <HealthConnectCard status={healthStatus} />

      <SectionLabel label="PERSONAL" />
      <MaxHrRow
        savedValue={maxHrQuery.data ?? null}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['settings-max-hr'] });
        }}
      />

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

      <Text className="text-micro text-ink-3 mt-8 text-center">Cadence · v0.1.0</Text>
    </Screen>
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
