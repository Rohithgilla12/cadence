import { IconX } from '@tabler/icons-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors, screenPaddingX } from '@/theme/tokens';

// Format the next Monday (or today if Monday) as YYYY-MM-DD for the start
// default. Weekly pacts feel right when they line up to Mon-Sun — same week
// boundary the running surface uses.
function nextWeekStart(reference: Date = new Date()): string {
  const day = reference.getDay(); // 0=Sun..6=Sat
  const offsetToMonday = (8 - day) % 7; // 0 if Mon, else days until next Mon
  const target = new Date(reference);
  target.setHours(0, 0, 0, 0);
  target.setDate(reference.getDate() + (offsetToMonday === 0 ? 7 : offsetToMonday));
  return toIsoDate(target);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHuman(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NewPactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ circleId: string }>();
  const circleId = String(params.circleId ?? '');

  const [text, setText] = useState('');
  const [startDate, setStartDate] = useState(nextWeekStart());
  // 7-day default duration; user can re-pick the start to slide the window.
  const endDate = addDaysIso(startDate, 7);

  const createMutation = useMutation({
    mutationFn: () =>
      endpoints.createPact(apiClient)(circleId, {
        text: text.trim(),
        startDate,
        endDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.circlePacts(circleId) });
      router.back();
    },
    onError: (err) => {
      Alert.alert('Could not create', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const canSubmit = text.trim().length > 0 && !createMutation.isPending && circleId.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingHorizontal: screenPaddingX,
            paddingBottom: 24,
          }}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-serif text-h1 text-ink">New pact</Text>
              <Text className="font-serif italic text-body text-ink-2 mt-2">
                Shared, weekly, collective. Not a race.
              </Text>
            </View>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={12}
              className="p-1 -mr-1"
            >
              <IconX size={22} color={colors.ink2} strokeWidth={1.5} />
            </Pressable>
          </View>

          <View className="mt-8 gap-5">
            <View>
              <Text className="text-eyebrow text-ink-3 uppercase mb-2">COMMITMENT</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="e.g. Three runs this week"
                placeholderTextColor={colors.ink3}
                maxLength={200}
                multiline
                autoFocus
                className="text-body text-ink border-b border-hairline pb-2"
              />
              <Text className="text-caption text-ink-3 mt-2">
                Phrase it as something everyone can mark complete on their own terms.
              </Text>
            </View>

            <View>
              <Text className="text-eyebrow text-ink-3 uppercase mb-2">WINDOW</Text>
              <View className="flex-row gap-2">
                <DateChip
                  label="This week"
                  isoStart={toIsoDate(new Date())}
                  active={startDate === toIsoDate(new Date())}
                  onPress={() => setStartDate(toIsoDate(new Date()))}
                />
                <DateChip
                  label="Next Monday"
                  isoStart={nextWeekStart()}
                  active={startDate === nextWeekStart()}
                  onPress={() => setStartDate(nextWeekStart())}
                />
              </View>
              <Text className="text-caption text-ink-3 mt-3">
                {formatHuman(startDate)} — {formatHuman(endDate)} (7 days)
              </Text>
            </View>
          </View>
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
            label={createMutation.isPending ? 'Setting…' : 'Set pact'}
            variant="primary"
            fullWidth
            disabled={!canSubmit}
            onPress={() => createMutation.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function DateChip({
  label,
  active,
  onPress,
}: {
  label: string;
  isoStart: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      className={`rounded-full px-3 py-1.5 border ${
        active ? 'bg-moss-bg border-moss-light' : 'bg-transparent border-hairline-2'
      }`}
    >
      <Text className={`text-micro ${active ? 'text-moss' : 'text-ink-2'}`}>{label}</Text>
    </Pressable>
  );
}
