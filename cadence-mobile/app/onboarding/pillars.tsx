import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionTile, StepHeader, StepProgressDots } from '@/components/onboarding';
import { Button } from '@/components/primitives';
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
    onSuccess: (me) => {
      queryClient.setQueryData<Me>(queryKeys.me, me);
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
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
        }}
      >
        <StepProgressDots current={2} total={4} />
        <View className="mt-6">
          <StepHeader
            title="What matters to you?"
            subtitle="Pick the parts of your life Cadence should pay attention to."
          />
        </View>
        <View className="mt-8 gap-3">
          {PILLAR_OPTIONS.map((opt) => (
            <OptionTile
              key={opt.id}
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
