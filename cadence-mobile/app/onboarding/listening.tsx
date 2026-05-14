import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand';
import { Button } from '@/components/primitives';
import { colors, screenPaddingX } from '@/theme/tokens';

// The closing page of the onboarding journal. A single image, a single
// sentence, the mark gently breathing. After a brief pause the user
// can tap into the app — no forced timer, no celebration.
const CALM_EASING = Easing.bezier(0.2, 0, 0.13, 1);

export default function OnboardingListeningScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const markIn = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const breath = useSharedValue(1);

  useEffect(() => {
    markIn.value = withTiming(1, { duration: 720, easing: CALM_EASING });
    titleIn.value = withDelay(420, withTiming(1, { duration: 720, easing: CALM_EASING }));
    ctaIn.value = withDelay(1200, withTiming(1, { duration: 560, easing: CALM_EASING }));
    // Continuous slow breath — DS §1 mentions a 1.0→1.03 scale over
    // 4 seconds for the recovery card. Here it's the same idea, but
    // continuous, because this *is* the recovery moment. The user has
    // just made several choices; the mark exhales for them.
    breath.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 2400, easing: CALM_EASING }),
          withTiming(1, { duration: 2400, easing: CALM_EASING }),
        ),
        -1,
        false,
      ),
    );
  }, [markIn, titleIn, ctaIn, breath]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markIn.value,
    transform: [{ scale: breath.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [{ translateY: (1 - titleIn.value) * 6 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaIn.value }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 24,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
          justifyContent: 'space-between',
        }}
      >
        <View />

        <View className="items-center">
          <Animated.View style={markStyle}>
            <BrandMark size={84} />
          </Animated.View>

          <Animated.View style={[{ marginTop: 56, maxWidth: 320 }, titleStyle]}>
            <Text className="font-serif text-display text-ink leading-tight text-center">
              Cadence is
              {'\n'}
              listening
              {'\n'}
              from here.
            </Text>
          </Animated.View>

          <Animated.View style={[{ marginTop: 24, maxWidth: 280 }, titleStyle]}>
            <Text className="text-body text-ink-2 leading-relaxed text-center">
              Check in tomorrow morning. Patterns surface
              after about two weeks of paired data.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[{ paddingBottom: insets.bottom + 8 }, ctaStyle]}>
          <Button
            label="Open Cadence"
            variant="primary"
            fullWidth
            onPress={() => router.replace('/')}
          />
        </Animated.View>
      </View>
    </View>
  );
}
