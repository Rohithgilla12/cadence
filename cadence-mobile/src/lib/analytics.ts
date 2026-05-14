import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

// Cadence's analytics surface. Routes through Firebase Analytics
// (already linked for Firebase Auth). PRD §15 — no PII. Event names
// are categorical; properties are bounded enums or counts, never
// free-text user content like habit names.
//
// All calls are fire-and-forget. The wrapper swallows errors so a
// transient analytics failure can't break a user action.

// Typed event registry. Every event Cadence logs MUST appear here so a
// rename or removal is a TypeScript-checked refactor — no string
// drift between call sites and the Firebase console.
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

// Internal: every event payload becomes Firebase's flat-object shape.
// Splits the discriminator off the name so the rest is the params.
function toParams(event: AnalyticsEvent): Record<string, unknown> {
  const { name: _name, ...rest } = event;
  return { ...rest, platform: Platform.OS };
}

let enabled = true;

// In development we keep analytics on by default but log to the console
// too so it's obvious what's being captured. Call setEnabled(false) at
// startup if a test harness needs full silence.
export function setEnabled(value: boolean): void {
  enabled = value;
}

export function track(event: AnalyticsEvent): void {
  if (!enabled) return;
  const params = toParams(event);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event.name, params);
  }
  // Fire-and-forget. Errors are swallowed — analytics failures should
  // never block UX.
  analytics()
    .logEvent(event.name, params as Record<string, string | number | boolean>)
    .catch(() => {});
}

// setUserProperties writes once per session. We deliberately set NO
// identifier here — PRD §15 forbids cross-app advertising IDs and we
// don't want Firebase building a stable per-person profile. Only
// categorical properties (intent, has_pillars) that aid funnel
// analysis without identifying anyone.
export interface AnalyticsProfile {
  has_pillars: boolean;
  has_intent: boolean;
}

export async function setProfile(profile: AnalyticsProfile): Promise<void> {
  if (!enabled) return;
  try {
    await analytics().setUserProperties({
      has_pillars: profile.has_pillars ? 'true' : 'false',
      has_intent: profile.has_intent ? 'true' : 'false',
    });
  } catch {
    // Ignore — analytics never blocks UX.
  }
}

// signOut wipes any cached user properties so the next user's session
// doesn't inherit them. Firebase Analytics' setUserId(null) also kills
// any user-scoped state on its side.
export async function reset(): Promise<void> {
  if (!enabled) return;
  try {
    await analytics().setUserId(null);
    await analytics().resetAnalyticsData();
  } catch {
    // Ignore.
  }
}
