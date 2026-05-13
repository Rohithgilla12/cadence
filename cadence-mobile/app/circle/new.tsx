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

export default function NewCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      endpoints.createCircle(apiClient)({
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: (circle) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.circles });
      // Replace so the Back button from detail returns to the tab, not here.
      router.replace({ pathname: '/circle/[id]', params: { id: circle.id } });
    },
    onError: (err) => {
      Alert.alert('Could not create', err instanceof Error ? err.message : 'Unknown error');
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
              <Text className="font-serif text-h1 text-ink">Start a circle</Text>
              <Text className="font-serif italic text-body text-ink-2 mt-2">
                Two or three friends is plenty.
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

          <View className="mt-8 gap-4">
            <View>
              <Text className="text-eyebrow text-ink-3 uppercase mb-2">NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Sunday runners"
                placeholderTextColor={colors.ink3}
                maxLength={80}
                autoFocus
                returnKeyType="next"
                className="text-body text-ink border-b border-hairline pb-2"
              />
            </View>
            <View>
              <Text className="text-eyebrow text-ink-3 uppercase mb-2">
                DESCRIPTION (OPTIONAL)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Long-run buddies, accountable for Sunday mornings."
                placeholderTextColor={colors.ink3}
                maxLength={200}
                multiline
                returnKeyType="done"
                className="text-body text-ink border-b border-hairline pb-2"
              />
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
            label={createMutation.isPending ? 'Starting…' : 'Start circle'}
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
