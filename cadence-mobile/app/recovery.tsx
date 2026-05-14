import { IconX } from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Pill } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors, screenPaddingX } from '@/theme/tokens';

// Day-old habits with streak=0 are the recovery candidates. Brand-new
// habits (streak=0, < 24h since created) aren't a recovery situation —
// they just don't have logs yet. PRD §3 voice: 'quiet day', never shame.
const RECOVERY_AGE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const REASONS = [
  { value: 'travel', label: 'Travel' },
  { value: 'rest', label: 'Rest' },
  { value: 'sick', label: 'Under the weather' },
  { value: 'busy', label: 'Just busy' },
  { value: 'off', label: 'Off day' },
] as const;

type ReasonValue = (typeof REASONS)[number]['value'] | undefined;

function yesterdayIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });

  const candidates = useMemo(() => {
    const now = Date.now();
    return (habitsQuery.data ?? []).filter((h) => {
      if (h.streak > 0) return false;
      const created = new Date(h.createdAt).getTime();
      return now - created > RECOVERY_AGE_THRESHOLD_MS;
    });
  }, [habitsQuery.data]);

  const [reasonByHabit, setReasonByHabit] = useState<Record<string, ReasonValue>>({});

  const skipMutation = useMutation({
    mutationFn: async () => {
      const date = yesterdayIso();
      await Promise.all(
        candidates.map((h) =>
          endpoints.skipHabit(apiClient)(h.id, {
            date,
            reason: reasonByHabit[h.id],
          }).catch(() => {
            // Best-effort: a single failure shouldn't block the rest. The user
            // can always come back tomorrow and tag again.
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
      router.back();
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-body-sm text-ink-3">Welcome back</Text>
            <Text className="font-serif text-h1 text-ink mt-1">A quiet day</Text>
            <Text className="font-serif italic text-body text-ink-2 mt-2">
              You're here. That's the work.
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            className="p-1 -mr-1"
          >
            <IconX size={22} color={colors.ink2} strokeWidth={1.5} />
          </Pressable>
        </View>

        {habitsQuery.isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator color={colors.moss} />
          </View>
        ) : candidates.length === 0 ? (
          <View className="mt-8">
            <Card padding="md">
              <Text className="text-body text-ink-2 font-serif italic">
                Nothing to tag — your practices are humming along.
              </Text>
            </Card>
          </View>
        ) : (
          <View className="mt-8 gap-3">
            <Text className="text-body text-ink-2 leading-relaxed">
              These practices were quiet yesterday. If anything got in the way, tag it —
              optional, just for your own pattern-spotting.
            </Text>
            {candidates.map((habit) => (
              <Card key={habit.id} padding="md">
                <Text className="text-body text-ink font-medium">{habit.name}</Text>
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {REASONS.map((reason) => {
                    const selected = reasonByHabit[habit.id] === reason.value;
                    return (
                      <Pill
                        key={reason.value}
                        label={reason.label}
                        selected={selected}
                        onPress={() =>
                          setReasonByHabit((prev) => ({
                            ...prev,
                            [habit.id]: selected ? undefined : reason.value,
                          }))
                        }
                      />
                    );
                  })}
                </View>
              </Card>
            ))}
            <Text className="text-caption text-ink-3 mt-3 font-serif italic">
              These notes stay with you. Cadence doesn't share them with circles or use them
              to lower a streak — they help us read your rhythm better.
            </Text>
          </View>
        )}
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
          label={
            skipMutation.isPending
              ? 'Saving…'
              : candidates.length > 0
                ? "I'm back today"
                : 'Back to Today'
          }
          variant="primary"
          fullWidth
          disabled={skipMutation.isPending}
          onPress={() =>
            candidates.length > 0 ? skipMutation.mutate() : router.back()
          }
        />
      </View>
    </View>
  );
}
