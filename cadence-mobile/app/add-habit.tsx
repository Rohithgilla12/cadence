import { IconX } from '@tabler/icons-react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconPicker, NameField, SourceLinkPicker, TimeOfDayPicker } from '@/components/habit';
import { SectionLabel } from '@/components/layout';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import type { ApiHabit, ApiHabitSourceLink, ApiTimeOfDay } from '@/lib/api/types';
import { apiClient } from '@/lib/client';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function AddHabitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('sparkles');
  const [timeOfDay, setTimeOfDay] = useState<ApiTimeOfDay>('anytime');
  const [sourceLink, setSourceLink] = useState<ApiHabitSourceLink | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      endpoints.createHabit(apiClient)({
        name: name.trim(),
        icon,
        timeOfDay,
        sourceLink: sourceLink ?? undefined,
        trackContext: true,
      }),
    onSuccess: (created) => {
      // Insert at the end of the cached list so the new row appears immediately
      // on the next render of Today — no waiting on a refetch.
      queryClient.setQueryData<ApiHabit[]>(queryKeys.habits, (current) =>
        current ? [...current, created] : [created],
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
      router.back();
    },
    onError: (err) => {
      Alert.alert(
        'Could not add',
        err instanceof Error ? err.message : 'Unknown error',
      );
    },
  });

  const canSubmit = name.trim().length > 0 && !createMutation.isPending;

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
              <Text className="font-serif text-h1 text-ink">Add a practice</Text>
              <Text className="font-serif italic text-body text-ink-2 mt-2">
                Two is plenty for the first week.
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

          <View className="mt-8">
            <NameField value={name} onChangeText={setName} />
          </View>

          <SectionLabel label="ICON" />
          <IconPicker value={icon} onChange={setIcon} />

          <SectionLabel label="WHEN" />
          <TimeOfDayPicker value={timeOfDay} onChange={setTimeOfDay} />

          <SectionLabel label="TRACK VIA" />
          <SourceLinkPicker value={sourceLink} onChange={setSourceLink} />
          <Text className="text-caption text-ink-3 mt-2">
            With Apple Health, matching workouts pre-check this habit. You can always untick.
          </Text>
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
            label={createMutation.isPending ? 'Adding…' : 'Add practice'}
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
