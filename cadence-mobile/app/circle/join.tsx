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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/primitives';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { apiClient } from '@/lib/client';
import { colors, screenPaddingX } from '@/theme/tokens';

// Accepts either the raw 20-char token or a full invite URL (universal link
// will eventually be e.g. https://cadence.gilla.fun/circle/join/<token>).
// We extract the last path segment if it looks URL-ish — friendlier paste.
function extractToken(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').filter((p) => p.length > 0);
    return parts[parts.length - 1] ?? '';
  }
  return trimmed;
}

export default function JoinCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState('');

  const joinMutation = useMutation({
    mutationFn: () => endpoints.joinCircle(apiClient)(extractToken(raw)),
    onSuccess: (circle) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.circles });
      router.replace({ pathname: '/circle/[id]', params: { id: circle.id } });
    },
    onError: (err) => {
      Alert.alert('Could not join', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const canSubmit = extractToken(raw).length > 0 && !joinMutation.isPending;

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
              <Text className="font-serif text-h1 text-ink">Paste an invite</Text>
              <Text className="font-serif italic text-body text-ink-2 mt-2">
                A friend sent you a link or code.
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
            <Text className="text-eyebrow text-ink-3 uppercase mb-2">INVITE</Text>
            <TextInput
              value={raw}
              onChangeText={setRaw}
              placeholder="paste link or code"
              placeholderTextColor={colors.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => canSubmit && joinMutation.mutate()}
              className="text-body text-ink border-b border-hairline pb-2"
            />
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
            label={joinMutation.isPending ? 'Joining…' : 'Join circle'}
            variant="primary"
            fullWidth
            disabled={!canSubmit}
            onPress={() => joinMutation.mutate()}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
