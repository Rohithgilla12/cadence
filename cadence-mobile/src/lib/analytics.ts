import { init as aptabaseInit, trackEvent } from '@aptabase/react-native';
import { Platform } from 'react-native';

// Cadence's analytics surface. Routes through Aptabase (EU region),
// chosen for: pure RN integration (no static-framework compile
// gymnastics — see plugins/withFirebaseStaticFrameworks.js for the
// CLANG flag the Aptabase target still needs), EU hosting that lines
// up with PRD §15 privacy posture, and a flat trackEvent API that
// matches our discriminated union exactly.
//
// All calls are fire-and-forget. The wrapper swallows errors so a
// transient analytics failure can't break a user action. Aptabase's
// own SDK additionally validates property shape and logs warnings on
// bad input rather than throwing.

// App Key is by design embedded in the client (Aptabase docs:
// "this key is public, no need to hide it"). The "A-EU-" prefix
// pins the SDK to the EU data region. If we ever rotate keys,
// move this through EXPO_PUBLIC_APTABASE_APP_KEY for environment
// override — the SDK accepts any non-empty string here.
const APP_KEY = 'A-EU-0510302652';

let initialized = false;

// Idempotent init — called once from app/_layout.tsx and a guard so
// importing the module doesn't trigger network setup on its own. The
// underlying SDK warns and disables tracking if the key is malformed,
// so we don't need additional validation.
export function initAnalytics(): void {
  if (initialized) return;
  try {
    aptabaseInit(APP_KEY);
    initialized = true;
  } catch {
    // Init never throws in practice; guard belt-and-braces.
  }
}

// Typed event registry. Every event Cadence logs MUST appear here so a
// rename or removal is a TypeScript-checked refactor — no string
// drift between call sites and the Aptabase dashboard.
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

function toProps(event: AnalyticsEvent): Record<string, string | number | boolean> {
  const { name: _name, ...rest } = event;
  return { ...rest, platform: Platform.OS } as Record<string, string | number | boolean>;
}

let enabled = true;

export function setEnabled(value: boolean): void {
  enabled = value;
}

export function track(event: AnalyticsEvent): void {
  if (!enabled) return;
  const props = toProps(event);
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[analytics]', event.name, props);
  }
  try {
    trackEvent(event.name, props);
  } catch {
    // Analytics never blocks UX.
  }
}

// Profile + reset are kept on the API surface for symmetry with the
// earlier Firebase implementation. Aptabase doesn't have a user-
// property concept — it's session-based by design — so these are
// effectively no-ops today. Call sites continue to compile.
export interface AnalyticsProfile {
  has_pillars: boolean;
  has_intent: boolean;
}

export async function setProfile(_profile: AnalyticsProfile): Promise<void> {
  // No-op: Aptabase doesn't support user properties.
}

export async function reset(): Promise<void> {
  // No-op: Aptabase manages session IDs internally and rotates them
  // automatically after an hour of inactivity. Nothing to clear.
}
