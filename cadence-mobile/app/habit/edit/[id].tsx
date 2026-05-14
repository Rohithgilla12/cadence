import { IconX } from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  IconPicker,
  NameField,
  SharedWithPicker,
  SourceLinkPicker,
  TimeOfDayPicker,
} from '@/components/habit';
import { SectionLabel } from '@/components/layout';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors, screenPaddingX } from '@/theme/tokens';
import type { ApiHabitSourceLink, ApiTimeOfDay } from '@/lib/api/types';

export default function EditHabitScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const habitId = String(params.id ?? '');

  const habitsQuery = useQuery({
    queryKey: queryKeys.habits,
    queryFn: endpoints.listHabits(apiClient),
  });
  const existing = habitsQuery.data?.find((h) => h.id === habitId);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('sparkles');
  const [timeOfDay, setTimeOfDay] = useState<ApiTimeOfDay>('anytime');
  const [sourceLink, setSourceLink] = useState<ApiHabitSourceLink | null>(null);
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  // Seed the form once we've resolved the existing habit. Guarded so re-renders
  // don't blow away the user's in-progress edits.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !existing) return;
    setName(existing.name);
    setIcon(existing.icon);
    setTimeOfDay(existing.timeOfDay);
    setSourceLink(existing.sourceLink ?? null);
    setSharedWith(existing.sharedWith ?? []);
    setSeeded(true);
  }, [existing, seeded]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const sourceLinkChanged =
        JSON.stringify(sourceLink) !== JSON.stringify(existing?.sourceLink ?? null);
      return endpoints.updateHabit(apiClient)(habitId, {
        name: name.trim(),
        icon,
        timeOfDay,
        ...(sourceLinkChanged
          ? sourceLink
            ? { sourceLink }
            : { clearSourceLink: true }
          : {}),
        sharedWith,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits });
      router.back();
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const canSubmit = name.trim().length > 0 && seeded && !updateMutation.isPending;

  if (habitsQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }} className="items-center justify-center">
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }
  if (!existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 20, paddingHorizontal: screenPaddingX }}>
        <Text className="text-body text-ink-2">This practice is no longer in your list.</Text>
      </View>
    );
  }

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
              <Text className="font-serif text-h1 text-ink">Edit practice</Text>
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

          <SectionLabel label="SHARE WITH" />
          <SharedWithPicker value={sharedWith} onChange={setSharedWith} />
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
            label={updateMutation.isPending ? 'Saving…' : 'Save changes'}
            variant="primary"
            fullWidth
            disabled={!canSubmit}
            onPress={() => updateMutation.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
