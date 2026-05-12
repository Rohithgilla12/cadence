import { IconX } from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { MoodPicker, SleepStepper } from '@/components/checkin';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors, screenPaddingX } from '@/theme/tokens';
import type { Mood } from '@/types';

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function CheckInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const todayIso = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [mood, setMood] = useState<Mood | undefined>(undefined);
  const [sleepHours, setSleepHours] = useState<number | undefined>(undefined);
  const [note, setNote] = useState<string>('');

  const existingQuery = useQuery({
    queryKey: queryKeys.checkIn(todayIso),
    queryFn: () => endpoints.getCheckIn(apiClient)(todayIso),
  });

  useEffect(() => {
    if (existingQuery.data) {
      setMood(existingQuery.data.mood as Mood | undefined);
      setSleepHours(existingQuery.data.sleepHours);
      setNote(existingQuery.data.note ?? '');
    }
  }, [existingQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      endpoints.putCheckIn(apiClient)(todayIso, {
        mood,
        sleepHours,
        note: note.trim() ? note.trim() : undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.checkIn(todayIso), updated);
      router.back();
    },
    onError: (err) => {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Unknown error',
      );
    },
  });

  const canSave =
    !mutation.isPending &&
    (mood !== undefined || sleepHours !== undefined || note.trim().length > 0);

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
              <Text className="font-serif text-h1 text-ink">Check in</Text>
              <Text className="font-serif italic text-body text-ink-2 mt-2">
                {todayLabel()}
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

          <Text className="text-eyebrow text-ink-3 uppercase mt-8 mb-3">MOOD</Text>
          <MoodPicker value={mood} onChange={setMood} />

          <Text className="text-eyebrow text-ink-3 uppercase mt-8 mb-3">SLEEP</Text>
          <SleepStepper value={sleepHours} onChange={setSleepHours} />

          <Text className="text-eyebrow text-ink-3 uppercase mt-8 mb-3">
            NOTE (OPTIONAL)
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Anything to remember about today?"
            placeholderTextColor={colors.ink3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{
              fontFamily: 'Iowan Old Style',
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 20,
              color: colors.ink,
              paddingBottom: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.hairline2,
              minHeight: 80,
            }}
          />
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
            label={mutation.isPending ? 'Saving…' : 'Save'}
            variant="primary"
            fullWidth
            disabled={!canSave}
            onPress={() => mutation.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
