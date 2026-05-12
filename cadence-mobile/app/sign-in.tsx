import { IconBrandApple, IconBrandGoogle } from '@tabler/icons-react-native';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignInButton } from '@/components/auth/SignInButton';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';
import { colors, screenPaddingX } from '@/theme/tokens';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  async function handleApple() {
    setBusy('apple');
    try {
      await signInWithApple();
    } catch (err) {
      Alert.alert('Sign-in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert('Sign-in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View
      className="flex-1 bg-bg"
      style={{
        paddingTop: insets.top + 80,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: screenPaddingX,
      }}
    >
      <View className="flex-1 justify-center">
        <Text className="font-serif text-display text-ink">Cadence</Text>
        <Text className="mt-3 text-body text-ink-2">
          The quiet rhythm of becoming.
        </Text>
      </View>

      <View className="gap-3">
        {Platform.OS === 'ios' && (
          <SignInButton
            provider="apple"
            label="Continue with Apple"
            icon={<IconBrandApple size={18} color="#FFFFFF" strokeWidth={1.5} />}
            onPress={handleApple}
            disabled={busy !== null}
          />
        )}
        <SignInButton
          provider="google"
          label="Continue with Google"
          icon={<IconBrandGoogle size={18} color={colors.ink} strokeWidth={1.5} />}
          onPress={handleGoogle}
          disabled={busy !== null}
        />
        <Text className="text-caption text-ink-3 mt-4 text-center">
          By continuing you agree to the terms. We never sell your data.
        </Text>
      </View>
    </View>
  );
}
