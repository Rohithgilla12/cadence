import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalHeader, LineChoice, PageChapter } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { INTENT_OPTIONS } from '@/lib/onboarding';
import type { IntentId } from '@/lib/onboarding';
import type { Me } from '@/lib/api/types';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function IntentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<IntentId | null>(null);

  const mutation = useMutation({
    mutationFn: (intent: IntentId) => endpoints.updateMe(apiClient)({ intent }),
    onSuccess: (me) => {
      queryClient.setQueryData<Me>(queryKeys.me, me);
      router.push('/onboarding/pillars');
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

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
        <PageChapter current={1} total={4} />
        <View className="mt-10">
          <JournalHeader
            eyebrow="Why are you here"
            title="We start with why."
            subtitle="Pick one. You can change this later."
          />
        </View>
        <View className="mt-8 -mx-3">
          {INTENT_OPTIONS.map((opt) => (
            <LineChoice
              key={opt.id}
              mode="radio"
              label={opt.label}
              description={opt.description}
              selected={selected === opt.id}
              onPress={() => setSelected(opt.id)}
            />
          ))}
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
          label={mutation.isPending ? 'Saving…' : 'Continue'}
          variant="primary"
          fullWidth
          disabled={!selected || mutation.isPending}
          onPress={() => selected && mutation.mutate(selected)}
        />
      </View>
    </View>
  );
}
