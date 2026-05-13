import { IconX } from '@tabler/icons-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });

  const [displayName, setDisplayName] = useState('');

  // Seed the form once the GET resolves so the user lands on their current
  // value rather than an empty input.
  useEffect(() => {
    if (meQuery.data?.displayName) {
      setDisplayName(meQuery.data.displayName);
    }
  }, [meQuery.data?.displayName]);

  const updateMutation = useMutation({
    mutationFn: () =>
      endpoints.updateMe(apiClient)({ displayName: displayName.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.me, updated);
      router.back();
    },
    onError: (err) => {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  const trimmed = displayName.trim();
  const original = meQuery.data?.displayName?.trim() ?? '';
  const canSubmit = trimmed.length > 0 && trimmed !== original && !updateMutation.isPending;

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
              <Text className="font-serif text-h1 text-ink">Profile</Text>
              <Text className="font-serif italic text-body text-ink-2 mt-2">
                The name your circles see.
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
            <Text className="text-eyebrow text-ink-3 uppercase mb-2">DISPLAY NAME</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.ink3}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={() => canSubmit && updateMutation.mutate()}
              className="text-body text-ink border-b border-hairline pb-2"
            />
            <Text className="text-caption text-ink-3 mt-2">
              Email and Cadence handle stay tied to your Apple or Google sign-in. Edit those
              from your provider.
            </Text>
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
            label={updateMutation.isPending ? 'Saving…' : 'Save'}
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
