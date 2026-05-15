import { Redirect, useLocalSearchParams } from 'expo-router';

// Universal Link / App Link landing route. iOS and Android both
// intercept https://cadence.gilla.fun/circle/join/<token> and route the
// tap into this file. We don't render any UI here — instead we forward
// to the manual paste screen with the token pre-filled, so the auth
// gate, onboarding redirect, and join-error handling all live in one
// place. The custom-scheme variant (cadence://circle/join?token=...)
// from the web fallback page lands on /circle/join directly and skips
// this redirect entirely.
export default function JoinCircleByTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <Redirect
      href={{
        pathname: '/circle/join',
        params: { token: token ?? '' },
      }}
    />
  );
}
