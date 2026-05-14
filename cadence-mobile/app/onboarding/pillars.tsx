import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalHeader, LineChoice, PageChapter } from '@/components/onboarding';
import { Button } from '@/components/primitives';
import { track } from '@/lib/analytics';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { PILLAR_OPTIONS } from '@/lib/onboarding';
import type { PillarId } from '@/lib/onboarding';
import type { Me } from '@/lib/api/types';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function PillarsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<PillarId>>(new Set());

  function toggle(id: PillarId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: (pillars: PillarId[]) => endpoints.updateMe(apiClient)({ pillars }),
    onSuccess: (me, pillars) => {
      queryClient.setQueryData<Me>(queryKeys.me, me);
      track({ name: 'onboarding_pillars_picked', count: pillars.length });
      router.push('/onboarding/health');
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
        <PageChapter current={2} total={4} />
        <View className="mt-10">
          <JournalHeader
            eyebrow="What matters"
            title="The shape of your week."
            subtitle="Tap the parts of your life Cadence should pay attention to. Pick as many as ring true."
          />
        </View>
        <View className="mt-8 -mx-3">
          {PILLAR_OPTIONS.map((opt) => (
            <LineChoice
              key={opt.id}
              mode="check"
              label={opt.label}
              description={opt.description}
              selected={selected.has(opt.id)}
              onPress={() => toggle(opt.id)}
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
          disabled={selected.size === 0 || mutation.isPending}
          onPress={() => mutation.mutate(Array.from(selected))}
        />
      </View>
    </View>
  );
}
