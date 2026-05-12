# Apple Health Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Connect to Apple HealthKit on iOS, request read access for the scopes the PRD lists (sleep, steps, active energy, workouts, RHR, HRV-SDNN, mindful minutes), and surface the connection state on the You tab with a dedicated `/connect-health` screen. **Reads only; nothing leaves the device** in this plan.

**Architecture:**
- Library: `@kingstinct/react-native-healthkit` v9+ — modern TypeScript-first wrapper with an Expo config plugin that handles `Info.plist` usage descriptions automatically.
- Module: `src/lib/health/appleHealth.ts` is the platform-aware surface. All callers use it; nothing else imports the underlying lib. iOS-only — Android Health Connect lands in a separate plan.
- UI: a `<HealthConnectCard>` on the You tab shows status (Not connected / Connected) and links to `/connect-health`, a full-screen flow that explains scopes, requests permission, and confirms success in Cadence's voice.

**Tech Stack:** existing — Expo 54, React 19, NativeWind 4. New dep: `@kingstinct/react-native-healthkit@^9`.

**Out of scope (follow-ups):**
- Android Health Connect (separate plan)
- Sleep / steps prefill into `CheckInRow` (next plan — needs `/v1/check-ins` PUT mutation UI)
- Daily summary upload to server (`POST /v1/health/summaries`)
- Auto-detection of habit completions from health data (PRD §9, Phase 2 in the build sequence)
- Background HKObserverQuery for workouts (PRD §9, deferred to Phase 2)

---

## File map

```
cadence-mobile/
  package.json                              # MOD — add @kingstinct/react-native-healthkit
  app.json                                  # MOD — config plugin + usage descriptions
  src/lib/health/
    permissions.ts                          # NEW — sample-type scope arrays
    appleHealth.ts                          # NEW — isAvailable, requestPermissions, isAuthorized, readDailySummary
    types.ts                                # NEW — DailySummary, AuthStatus
    index.ts                                # NEW — barrel
  src/components/health/
    HealthConnectCard.tsx                   # NEW — You-tab tile
  app/connect-health.tsx                    # NEW — permission flow screen
  app/(tabs)/you.tsx                        # MOD — add Integrations section
```

---

## Task 1: Install + config plugin

**Files:** `package.json`, `app.json`

- [ ] **Step 1: Install**

```bash
cd cadence-mobile
bunx expo install @kingstinct/react-native-healthkit
```

- [ ] **Step 2: Add to plugins + usage descriptions**

Edit `cadence-mobile/app.json`. Append the plugin entry (keeping the existing array elements and the `extra.eas.projectId` block intact):

```json
[
  "@kingstinct/react-native-healthkit",
  {
    "NSHealthShareUsageDescription": "Cadence reads sleep, mood-affecting activity, and workouts to learn which habits move your rhythm. Your health data stays on this device.",
    "NSHealthUpdateUsageDescription": "Cadence does not write to Apple Health in this version."
  }
]
```

The exact phrasing matters — App Review reads these strings.

- [ ] **Step 3: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add cadence-mobile/package.json cadence-mobile/app.json cadence-mobile/bun.lock
git commit -m "feat(mobile): install @kingstinct/react-native-healthkit

Apple HealthKit reader. Usage descriptions phrased to make the privacy
posture explicit (data stays on device) — App Review will see this
string verbatim.

PRD §9, §15."
```

---

## Task 2: Health module — types + permissions + reads

**Files:**
- Create: `src/lib/health/types.ts`
- Create: `src/lib/health/permissions.ts`
- Create: `src/lib/health/appleHealth.ts`
- Create: `src/lib/health/index.ts`

- [ ] **Step 1: Types**

Create `src/lib/health/types.ts`:

```typescript
export type HealthAuthStatus = 'unavailable' | 'unknown' | 'authorized' | 'denied';

export interface DailySummary {
  date: string;            // YYYY-MM-DD, local timezone
  sleepHours?: number;
  steps?: number;
  activeEnergyKcal?: number;
  workouts: WorkoutSummary[];
}

export interface WorkoutSummary {
  activityName: string;    // e.g., 'Run', 'Yoga', 'Walk'
  startsAt: string;        // ISO
  endsAt: string;          // ISO
  durationMinutes: number;
  distanceMeters?: number;
}
```

- [ ] **Step 2: Permission scopes**

Create `src/lib/health/permissions.ts`:

```typescript
// Scopes per PRD §9. Read-only — no write scopes in v1.
export const READ_SAMPLE_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKWorkoutTypeIdentifier',
] as const;
```

- [ ] **Step 3: The wrapper**

Create `src/lib/health/appleHealth.ts`:

```typescript
import { Platform } from 'react-native';
import type { DailySummary, HealthAuthStatus, WorkoutSummary } from './types';
import { READ_SAMPLE_TYPES } from './permissions';

const isIOS = Platform.OS === 'ios';

// All HealthKit imports are inside async functions so non-iOS bundles never load
// the native module. The conditional dynamic import keeps Android/web builds clean.
async function loadHealthkit() {
  if (!isIOS) return null;
  // @ts-expect-error — runtime-only import; types resolved by the package itself when loaded
  return import('@kingstinct/react-native-healthkit');
}

export function isAvailable(): boolean {
  return isIOS;
}

export async function isAuthorized(): Promise<boolean> {
  const hk = await loadHealthkit();
  if (!hk) return false;
  try {
    // The library exposes getRequestStatusForAuthorization; a result of 'unnecessary'
    // means previously-granted scopes are already in place.
    const status = await hk.getRequestStatusForAuthorization(
      [],
      READ_SAMPLE_TYPES as unknown as readonly string[],
    );
    return status === 'unnecessary';
  } catch {
    return false;
  }
}

export async function getStatus(): Promise<HealthAuthStatus> {
  if (!isIOS) return 'unavailable';
  return (await isAuthorized()) ? 'authorized' : 'unknown';
}

export async function requestPermissions(): Promise<HealthAuthStatus> {
  const hk = await loadHealthkit();
  if (!hk) return 'unavailable';
  try {
    await hk.requestAuthorization(
      [],
      READ_SAMPLE_TYPES as unknown as readonly string[],
    );
    return (await isAuthorized()) ? 'authorized' : 'denied';
  } catch {
    return 'denied';
  }
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function readDailySummary(date: Date): Promise<DailySummary> {
  const summary: DailySummary = {
    date: toIsoDate(date),
    workouts: [],
  };
  const hk = await loadHealthkit();
  if (!hk) return summary;

  const start = startOfLocalDay(date);
  const end = endOfLocalDay(date);

  try {
    // Sleep — pull asleep samples, sum durations.
    const sleepSamples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      from: start,
      to: end,
    });
    const sleepMs = sleepSamples
      // Apple's sleep value codes: 1=inBed, 2=asleep, 3-5=stages. Count anything 2+ as asleep.
      .filter((s: { value: number }) => s.value >= 2)
      .reduce((acc: number, s: { startDate: string; endDate: string }) => {
        return acc + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime());
      }, 0);
    if (sleepMs > 0) summary.sleepHours = Math.round((sleepMs / 36e5) * 10) / 10;
  } catch {}

  try {
    const stepsAgg = await hk.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      start,
      end,
    );
    if (stepsAgg?.sumQuantity?.quantity != null) {
      summary.steps = Math.round(stepsAgg.sumQuantity.quantity);
    }
  } catch {}

  try {
    const energyAgg = await hk.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      ['cumulativeSum'],
      start,
      end,
    );
    if (energyAgg?.sumQuantity?.quantity != null) {
      summary.activeEnergyKcal = Math.round(energyAgg.sumQuantity.quantity);
    }
  } catch {}

  try {
    const workouts = await hk.queryWorkouts({ from: start, to: end });
    summary.workouts = workouts.map((w: {
      workoutActivityType: number;
      startDate: string;
      endDate: string;
      duration: number;
      totalDistance?: { quantity: number };
    }) => ({
      activityName: activityNameFor(w.workoutActivityType),
      startsAt: w.startDate,
      endsAt: w.endDate,
      durationMinutes: Math.round(w.duration / 60),
      distanceMeters: w.totalDistance?.quantity,
    }));
  } catch {}

  return summary;
}

// Minimal mapping. Expand with more activity types as habits demand.
// Reference: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
function activityNameFor(type: number): string {
  switch (type) {
    case 37: return 'Run';
    case 52: return 'Walk';
    case 13: return 'Cycling';
    case 35: return 'Yoga';
    case 24: return 'Hike';
    case 46: return 'Swim';
    default: return 'Workout';
  }
}

export type { DailySummary, HealthAuthStatus, WorkoutSummary };
```

The `@ts-expect-error` and structural casts work around the library's typed surface vs our internal abstraction; they keep the module self-contained so we can swap the underlying lib later without touching every call site.

- [ ] **Step 4: Barrel**

Create `src/lib/health/index.ts`:

```typescript
export {
  isAvailable,
  isAuthorized,
  getStatus,
  requestPermissions,
  readDailySummary,
} from './appleHealth';
export type { DailySummary, HealthAuthStatus, WorkoutSummary } from './types';
```

- [ ] **Step 5: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add cadence-mobile/src/lib/health
git commit -m "feat(mobile): Apple HealthKit reader module

Platform-aware wrapper around @kingstinct/react-native-healthkit.
readDailySummary returns the per-day rollup (sleep hours, steps,
active energy, workouts) the correlation engine will eventually
consume. iOS-only; Android calls return safe defaults. Dynamic
import keeps non-iOS bundles free of HealthKit native code.

PRD §9, §15 (data stays on device)."
```

---

## Task 3: Connect Apple Health screen

**Files:**
- Create: `cadence-mobile/app/connect-health.tsx`
- Create: `cadence-mobile/src/components/health/HealthConnectCard.tsx`

- [ ] **Step 1: HealthConnectCard**

Create `src/components/health/HealthConnectCard.tsx`:

```tsx
import { IconChevronRight, IconHeartHandshake } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/primitives';
import { colors } from '@/theme/tokens';
import type { HealthAuthStatus } from '@/lib/health';

interface HealthConnectCardProps {
  status: HealthAuthStatus;
}

function statusLabel(status: HealthAuthStatus): string {
  switch (status) {
    case 'authorized': return 'Connected';
    case 'denied': return 'Not granted';
    case 'unavailable': return 'iOS only';
    default: return 'Not connected';
  }
}

export function HealthConnectCard({ status }: HealthConnectCardProps) {
  const router = useRouter();
  const isUnavailable = status === 'unavailable';
  return (
    <Card padding="md">
      <Pressable
        onPress={() => !isUnavailable && router.push('/connect-health')}
        disabled={isUnavailable}
        accessibilityRole="button"
        accessibilityLabel="Apple Health connection"
        className="flex-row items-center gap-3"
        style={({ pressed }) => (pressed && !isUnavailable ? { opacity: 0.9 } : undefined)}
      >
        <View className="w-9 h-9 rounded-full bg-moss-bg items-center justify-center">
          <IconHeartHandshake size={18} color={colors.moss} strokeWidth={1.5} />
        </View>
        <View className="flex-1">
          <Text className="text-body text-ink font-medium">Apple Health</Text>
          <Text className="text-caption text-ink-3 mt-0.5">{statusLabel(status)}</Text>
        </View>
        {!isUnavailable && (
          <IconChevronRight size={18} color={colors.ink3} strokeWidth={1.5} />
        )}
      </Pressable>
    </Card>
  );
}
```

- [ ] **Step 2: connect-health screen**

Create `cadence-mobile/app/connect-health.tsx`:

```tsx
import { IconArrowLeft, IconBolt, IconHeartbeat, IconMoon, IconRun } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/primitives';
import { getStatus, requestPermissions } from '@/lib/health';
import { colors, screenPaddingX } from '@/theme/tokens';
import type { HealthAuthStatus } from '@/lib/health';

interface Scope {
  label: string;
  icon: React.ReactNode;
}

const SCOPES: Scope[] = [
  { label: 'Sleep duration and stages',           icon: <IconMoon size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Steps and active energy',             icon: <IconBolt size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Workouts (runs, walks, yoga, swim)',  icon: <IconRun size={18} color={colors.moss} strokeWidth={1.5} /> },
  { label: 'Resting heart rate and HRV',          icon: <IconHeartbeat size={18} color={colors.moss} strokeWidth={1.5} /> },
];

export default function ConnectHealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<HealthAuthStatus>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  async function handleConnect() {
    if (status === 'unavailable') return;
    setBusy(true);
    try {
      const next = await requestPermissions();
      setStatus(next);
      if (next === 'authorized') {
        // Brief moment to let the success sink in, then route home.
        setTimeout(() => router.back(), 600);
      }
    } catch (err) {
      Alert.alert('Could not connect', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      className="flex-1 bg-bg"
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: screenPaddingX,
      }}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="self-start py-2 -ml-2 px-2"
      >
        <IconArrowLeft size={22} color={colors.ink} strokeWidth={1.5} />
      </Pressable>

      <View className="mt-8">
        <Text className="text-h1 font-serif text-ink">Connect Apple Health</Text>
        <Text className="mt-3 text-body text-ink-2">
          Cadence reads what your phone already knows so we can show you what moves your rhythm. Nothing leaves this device.
        </Text>
      </View>

      <View className="mt-8 gap-3">
        {SCOPES.map((scope) => (
          <View key={scope.label} className="flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-moss-bg items-center justify-center">
              {scope.icon}
            </View>
            <Text className="text-body text-ink flex-1">{scope.label}</Text>
          </View>
        ))}
      </View>

      <View className="flex-1" />

      {status === 'authorized' ? (
        <View className="items-center mb-4">
          <Text className="text-body text-moss font-medium">Connected</Text>
        </View>
      ) : null}

      {status === 'unavailable' ? (
        <Text className="text-caption text-ink-3 mb-3 text-center">
          Apple Health is iOS-only. Health Connect for Android is coming soon.
        </Text>
      ) : null}

      <Button
        label={status === 'authorized' ? 'Done' : busy ? 'Connecting…' : 'Connect Apple Health'}
        onPress={status === 'authorized' ? () => router.back() : handleConnect}
        disabled={busy || status === 'unavailable'}
      />
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add cadence-mobile/app/connect-health.tsx cadence-mobile/src/components/health
git commit -m "feat(mobile): connect-health screen + integration card

Permission flow lists the scopes Cadence wants in plain English
('what your phone already knows') and re-states the privacy posture
('nothing leaves this device') in the body — that's the language
PRD §15 calls for. HealthConnectCard surfaces the status on the You
tab and routes here on tap.

PRD §9, §15, §20."
```

---

## Task 4: Wire into You tab

**Files:**
- Modify: `cadence-mobile/app/(tabs)/you.tsx`

- [ ] **Step 1: Add Integrations section + live status**

Replace `cadence-mobile/app/(tabs)/you.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { Avatar, Button } from '@/components/primitives';
import { HealthConnectCard } from '@/components/health/HealthConnectCard';
import { Screen, SectionLabel } from '@/components/layout';
import { endpoints } from '@/lib/api';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/client';
import { getStatus } from '@/lib/health';
import type { HealthAuthStatus } from '@/lib/health';
import { colors } from '@/theme/tokens';

export default function YouScreen() {
  const { signOut, user } = useAuth();
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: endpoints.getMe(apiClient),
  });

  const [healthStatus, setHealthStatus] = useState<HealthAuthStatus>('unknown');

  // Re-check HealthKit auth every time the tab gains focus so a fresh grant
  // from /connect-health flips the card to "Connected" without an app reload.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getStatus().then((s) => {
        if (!cancelled) setHealthStatus(s);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      Alert.alert('Sign-out failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }

  if (meQuery.isLoading) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.moss} />
        </View>
      </Screen>
    );
  }

  if (meQuery.isError) {
    return (
      <Screen scroll={false}>
        <Text className="text-body text-ink-2">
          We couldn't reach the server. Pull down to retry once that's wired in.
        </Text>
      </Screen>
    );
  }

  const me = meQuery.data;
  const displayName = me?.displayName || user?.displayName || 'Quiet traveler';
  const email = me?.email || user?.email || '';

  return (
    <Screen>
      <Text className="font-serif text-h1 text-ink">You</Text>

      <View className="mt-6 flex-row items-center gap-3">
        <Avatar name={displayName} size={72} />
        <View className="flex-1">
          <Text className="text-h3 text-ink font-medium">{displayName}</Text>
          {email ? <Text className="text-body-sm text-ink-2 mt-0.5">{email}</Text> : null}
        </View>
      </View>

      <SectionLabel label="INTEGRATIONS" />
      <HealthConnectCard status={healthStatus} />

      <SectionLabel label="ACCOUNT" />
      <Button label="Sign out" variant="ghost" onPress={handleSignOut} />
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
bunx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add cadence-mobile/app/\(tabs\)/you.tsx
git commit -m "feat(mobile): Integrations section on You tab

HealthConnectCard surfaces Apple Health status. useFocusEffect
re-queries authorization when the tab regains focus so a fresh
permission grant on /connect-health flips the badge to 'Connected'
without an app reload.

PRD §9, §15."
```

---

## Plan complete

After Task 4:

- `bunx tsc --noEmit` clean.
- 4 new commits on top of Phase F's last commit.
- The user can tap You → Apple Health → grant permission → return to a "Connected" state.
- `readDailySummary(date)` returns sleep + steps + workouts + active energy for any day. Nothing uses it yet on screen, but it's exported and ready for the next plan.

**Manual smoke test the user runs (after `expo prebuild --clean` and `expo run:ios`):**
1. Tap You.
2. Tap the Apple Health row.
3. Confirm the scope list reads correctly in Cadence's voice.
4. Tap Connect Apple Health → iOS prompts with the usage description from `app.json`.
5. Grant all read scopes → return to /connect-health → "Connected" appears → auto-routes back.
6. Tap into You again → card now reads "Connected".

**Next plan candidates:**
- Wire `readDailySummary` into CheckInRow to prefill the sleep value when the user hasn't logged it manually.
- `POST /v1/health/summaries` endpoint + nightly client upload.
- Android Health Connect parity.
- Strava OAuth (different track entirely — server-side data, not on-device).

· · ·
