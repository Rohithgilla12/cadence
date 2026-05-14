import { Platform } from 'react-native';

// Cadence's analytics surface — currently a no-op stub.
//
// History: a Firebase Analytics implementation
// (@react-native-firebase/analytics) was wired here, but its iOS
// compile fails under our `use_frameworks! :static` linkage and the
// usual `use_modular_headers!` fix didn't resolve it. Same root cause
// that pushed FCM → Expo Push earlier. Rather than burn more time on
// the build-config rabbit hole, we kept the call-site abstraction
// (every track() invocation across the app still typechecks) and made
// the SDK side a no-op. Pre-launch we can wire PostHog, Aptabase, or
// any other pure-RN SDK here — the rest of the codebase doesn't need
// to change.
//
// PRD §15 stays clean either way: nothing leaves the device through
// this module today.

export type AnalyticsEvent =
  | { name: 'onboarding_started' }
  | { name: 'onboarding_intent_picked'; intent: string }
  | { name: 'onboarding_pillars_picked'; count: number }
  | { name: 'onboarding_health_outcome'; outcome: 'authorized' | 'denied' | 'unavailable' | 'skipped' }
  | { name: 'onboarding_practices_chosen'; count: number }
  | { name: 'onboarding_completed' }
  | { name: 'health_import_completed'; days: number }
  | { name: 'habit_created'; time_of_day: string; has_source_link: boolean }
  | { name: 'habit_toggled'; done: boolean; source: 'manual' | 'apple_health' | 'health_connect' | 'strava' }
  | { name: 'habit_archived' }
  | { name: 'check_in_saved'; has_mood: boolean; has_sleep: boolean }
  | { name: 'insight_viewed'; pattern_type: string }
  | { name: 'reflect_opened' }
  | { name: 'circle_created' }
  | { name: 'circle_joined' }
  | { name: 'pact_created' }
  | { name: 'pact_completed' }
  | { name: 'push_permission_outcome'; granted: boolean }
  | { name: 'push_test_sent' }
  | { name: 'sign_in_started'; provider: 'apple' | 'google' }
  | { name: 'sign_in_completed'; provider: 'apple' | 'google' }
  | { name: 'sign_out' }
  | { name: 'account_deleted' };

let enabled = true;

export function setEnabled(value: boolean): void {
  enabled = value;
}

// In __DEV__ we log to the console so the event stream is at least
// observable during development. In production this is silent.
export function track(event: AnalyticsEvent): void {
  if (!enabled) return;
  if (__DEV__) {
    const { name: _name, ...rest } = event;
    // eslint-disable-next-line no-console
    console.log('[analytics:noop]', event.name, { ...rest, platform: Platform.OS });
  }
}

export interface AnalyticsProfile {
  has_pillars: boolean;
  has_intent: boolean;
}

export async function setProfile(_profile: AnalyticsProfile): Promise<void> {
  // No-op until a real analytics provider is wired in.
}

export async function reset(): Promise<void> {
  // No-op.
}
