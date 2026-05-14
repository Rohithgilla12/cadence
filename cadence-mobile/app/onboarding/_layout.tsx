import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        // Fade replaces slide-from-right. The journal motif wants page
        // turns, not horizontal device-y motion; fading also keeps the
        // header chapter marker from flying in and undercutting the
        // typographic moment.
        animation: 'fade',
        animationDuration: 320,
        gestureEnabled: false,
      }}
    />
  );
}
