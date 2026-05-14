import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand';
import { Button } from '@/components/primitives';
import { track } from '@/lib/analytics';
import { colors, screenPaddingX } from '@/theme/tokens';

// The opening page. Single moment, lots of room. Three staggered fades:
// mark, headline, body. Cadence's stated easings — cubic-bezier
// (0.2, 0, 0.13, 1), durations capped at 320ms — applied here, so
// the moment feels considered rather than performed. The brand mark
// breathes once (a hint at the recovery card showcase loop) and rests.
const CALM_EASING = Easing.bezier(0.2, 0, 0.13, 1);

export default function OnboardingWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const markIn = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const bodyIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const markBreath = useSharedValue(1);

  useEffect(() => {
    markIn.value = withTiming(1, { duration: 600, easing: CALM_EASING });
    titleIn.value = withDelay(280, withTiming(1, { duration: 560, easing: CALM_EASING }));
    bodyIn.value = withDelay(640, withTiming(1, { duration: 560, easing: CALM_EASING }));
    ctaIn.value = withDelay(1000, withTiming(1, { duration: 480, easing: CALM_EASING }));
    // One slow breath, then rest. Subtler than a loop — sets the tone
    // without becoming a repeating attention pull.
    markBreath.value = withDelay(
      900,
      withTiming(1.04, { duration: 1800, easing: CALM_EASING }, () => {
        markBreath.value = withTiming(1, { duration: 1800, easing: CALM_EASING });
      }),
    );
  }, [markIn, titleIn, bodyIn, ctaIn, markBreath]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markIn.value,
    transform: [{ scale: markBreath.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [{ translateY: (1 - titleIn.value) * 8 }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyIn.value,
    transform: [{ translateY: (1 - bodyIn.value) * 6 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaIn.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 80,
          paddingHorizontal: screenPaddingX,
          paddingBottom: 24,
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Animated.View style={markStyle}>
            <BrandMark size={68} />
          </Animated.View>

          <Animated.View style={[{ marginTop: 56 }, titleStyle]}>
            <Text className="font-serif text-display text-ink leading-tight">
              The quiet rhythm
              {'\n'}
              of becoming.
            </Text>
          </Animated.View>

          <Animated.View style={[{ marginTop: 24, maxWidth: 320 }, bodyStyle]}>
            <Text className="text-body text-ink-2 leading-relaxed">
              Cadence is a habit tracker for runners and the quietly committed.
              It pairs what you do with how you slept, your HRV, your runs —
              and after about two weeks, tells you which lever actually moves
              your rhythm.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[{ paddingBottom: insets.bottom + 8 }, ctaStyle]}>
          <Button
            label="Begin"
            variant="primary"
            fullWidth
            onPress={() => {
              track({ name: 'onboarding_started' });
              router.push('/onboarding/intent');
            }}
          />
          <View className="mt-3 items-center">
            <Text
              className="text-eyebrow text-ink-3 uppercase"
              style={{ letterSpacing: 2.5 }}
            >
              Takes about a minute
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
