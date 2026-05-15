// =============================================================================
// SKETCH — does not compile until `react-native-health-connect` is installed
// and the file-structure split below is applied.
//
// This file is the Android counterpart to `appleHealth.ts`. It exposes the
// EXACT same public surface (isAvailable / isAuthorized / getStatus /
// requestPermissions / readDailySummary / readWorkoutsRange / HealthKitError)
// so the 11 call sites that import from `@/lib/health` don't change at all.
//
// File-structure pattern to apply after this sketch is approved:
//
//   src/lib/health/
//     index.ios.ts          # re-export from ./appleHealth  (iOS bundle)
//     index.android.ts      # re-export from ./healthConnect (Android bundle)
//     appleHealth.ts        # unchanged
//     healthConnect.ts      # this file
//     types.ts              # shared
//     autodetect.ts         # pure logic, unchanged
//     heartRate.ts          # needs an Android counterpart (separate sketch)
//     workoutRoute.ts       # needs an Android counterpart (separate sketch)
//     import.ts             # historical-import — same dispatch story
//
// Metro auto-resolves `.ios.ts` on iOS and `.android.ts` on Android, so the
// HealthKit native module never enters the Android bundle and Health Connect
// never enters the iOS bundle. No Platform.OS branches needed at any of the
// 11 call sites.
//
// Honest semantic differences to know about:
//
// 1. HRV: HealthKit gives **SDNN** (standard deviation of NN intervals).
//    Health Connect gives **RMSSD** (root mean square of successive
//    differences). Both are valid HRV metrics but compute differently and
//    have different healthy-adult ranges (SDNN ~40-100 ms, RMSSD ~20-90 ms).
//    The correlation engine in cadence-api/internal/insight needs to be
//    aware: an Android user's HRV samples are not directly comparable to
//    an iOS user's. We tag the metric in the upload (see types.ts:
//    `hrvMs` + a new `hrvMetric: 'sdnn' | 'rmssd'`) so the server can
//    bucket per-user-platform baselines correctly. PRD §8 — never present
//    correlation as causation; cross-metric comparison would be exactly
//    that mistake.
//
// 2. Sleep stage codes are different integers:
//      HealthKit: inBed=0, asleepUnspecified=1, awake=2,
//                 asleepCore=3, asleepDeep=4, asleepREM=5
//      Health Connect: UNKNOWN=0, AWAKE=1, SLEEPING=2, OUT_OF_BED=3,
//                      LIGHT=4, DEEP=5, REM=6, AWAKE_IN_BED=7
//    Mapping is straightforward (LIGHT ≈ core, DEEP ≈ deep, REM ≈ REM,
//    AWAKE/AWAKE_IN_BED → awake) — done inline below. The end-user shapes
//    in `SleepStages` stay identical.
//
// 3. Steps / Distance / ActiveCaloriesBurned on Android come back as
//    multi-unit aggregate objects ({inMeters, inKilometers, inKilocalories,
//    ...}) rather than HealthKit's raw quantity. We pick the same canonical
//    unit appleHealth.ts chose (meters for distance, kcal for energy,
//    integer count for steps) so DailySummary values are interchangeable.
//
// 4. Resting heart rate and HRV are sampled, not aggregated — read the
//    most recent record in the daily window with `pageSize: 1,
//    ascendingOrder: false`. Same shape as HealthKit's `['mostRecent']`.
//
// 5. Workouts (ExerciseSession on Android) don't carry distance inline.
//    To get per-workout distance, we'd need to read Distance records and
//    intersect with each session's [startTime, endTime] window. For the
//    daily-summary use case the per-session distance is best-effort —
//    weekly mileage in `readWorkoutsRange` is the only consumer that
//    really cares, and we can do the join there.
// =============================================================================

import { Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import type { DailySummary, HealthAuthStatus, SleepStages, WorkoutSummary } from './types';

const isAndroid = Platform.OS === 'android';

// Same shape as HealthKitError in appleHealth.ts. Kept named the same so
// call sites can catch a single error class regardless of platform.
export class HealthKitError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HealthKitError';
  }
}

// Records Cadence reads from Health Connect. Order does not matter; the
// granted-permissions response is a subset (user can deny individuals).
const READ_RECORD_TYPES = [
  'Steps',
  'Distance',
  'ActiveCaloriesBurned',
  'HeartRate',
  'HeartRateVariabilityRmssd',
  'RestingHeartRate',
  'SleepSession',
  'ExerciseSession',
] as const;

const READ_PERMISSIONS: Permission[] = READ_RECORD_TYPES.map((recordType) => ({
  accessType: 'read',
  recordType,
}));

// Health Connect requires `initialize()` once per process. The lib is
// idempotent on repeat calls but we cache the promise to avoid extra
// native trips.
let initializePromise: Promise<boolean> | null = null;
async function ensureInitialized(): Promise<boolean> {
  if (!isAndroid) return false;
  if (!initializePromise) initializePromise = initialize();
  return initializePromise;
}

// =============================================================================
// Availability + permissions
// =============================================================================

export function isAvailable(): boolean {
  if (!isAndroid) return false;
  // getSdkStatus is async, but appleHealth's isAvailable is sync. We can't
  // perfectly mirror — but we CAN do a best-effort that the iOS contract
  // tolerates: return true on Android by default, let getStatus()/auth
  // calls surface the real availability asynchronously. Call sites
  // already follow isAvailable() with isAuthorized()/requestPermissions(),
  // so a too-optimistic isAvailable() doesn't break the flow.
  return true;
}

export async function isAuthorized(): Promise<boolean> {
  if (!isAndroid) return false;
  try {
    const initialized = await ensureInitialized();
    if (!initialized) return false;
    const granted = await getGrantedPermissions();
    // Sleep + workouts are the bare minimum for Cadence's correlations to
    // work. Without those, the app can render but every Today tile is
    // empty. Treat "authorized" as "has the wedge-critical permissions."
    const grantedTypes = new Set(granted.map((p) => p.recordType));
    return grantedTypes.has('SleepSession') && grantedTypes.has('ExerciseSession');
  } catch {
    return false;
  }
}

export async function getStatus(): Promise<HealthAuthStatus> {
  if (!isAndroid) return 'unavailable';
  try {
    const sdk = await getSdkStatus();
    if (sdk === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'unavailable';
    if (sdk === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      // Health Connect provider on this device is too old. From the user's
      // POV this is "not available yet, install/update the Health Connect
      // app from Play Store first." Treat as unavailable for now; later we
      // can surface a more actionable state if the connect-health screen
      // wants to deep-link them to the Play Store entry.
      return 'unavailable';
    }
    return (await isAuthorized()) ? 'authorized' : 'unknown';
  } catch {
    return 'unavailable';
  }
}

export async function requestPermissions(): Promise<HealthAuthStatus> {
  if (!isAndroid) return 'unavailable';
  try {
    await ensureInitialized();
    await requestPermission(READ_PERMISSIONS);
    return (await isAuthorized()) ? 'authorized' : 'denied';
  } catch (err) {
    throw new HealthKitError(
      err instanceof Error ? err.message : 'Health Connect authorization failed',
      err,
    );
  }
}

// =============================================================================
// Daily summary
// =============================================================================

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}
function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

// Same "last night" definition as iOS: 6pm previous day → 11am current.
function lastNightWindow(date: Date): { startTime: string; endTime: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 18, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Same merge logic as appleHealth.ts. Health Connect's SleepSession is a
// single record with a `stages` array — the parent session shouldn't
// overlap with itself, but multiple sources (Google Fit, Samsung Health,
// Fitbit) syncing into the same Health Connect store can produce
// overlapping sessions for the same night. Treat them like HealthKit's
// multi-source samples and merge.
function mergeIntervals(
  intervals: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [s, e] = sorted[i];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

// Health Connect SleepSession stage codes → Cadence's SleepStages buckets.
const STAGE_AWAKE = 1;
const STAGE_SLEEPING = 2; // generic "asleep" with no further subdivision
const STAGE_LIGHT = 4;
const STAGE_DEEP = 5;
const STAGE_REM = 6;
const STAGE_AWAKE_IN_BED = 7;

export async function readDailySummary(date: Date): Promise<DailySummary> {
  const summary: DailySummary = { date: toIsoDate(date), workouts: [] };
  if (!isAndroid) return summary;

  await ensureInitialized();

  const dayStart = startOfLocalDay(date).toISOString();
  const dayEnd = endOfLocalDay(date).toISOString();
  const dayFilter = { operator: 'between' as const, startTime: dayStart, endTime: dayEnd };

  // Sleep — use the wider "last night" window.
  try {
    const sleepWindow = lastNightWindow(date);
    const sleep = await readRecords('SleepSession', {
      timeRangeFilter: { operator: 'between', ...sleepWindow },
    });

    // Merge whole sessions to avoid double-counting overlapping sources.
    const sessionIntervals: Array<[number, number]> = sleep.records.map((rec) => [
      new Date(rec.startTime).getTime(),
      new Date(rec.endTime).getTime(),
    ]);
    const merged = mergeIntervals(sessionIntervals);
    const ms = merged.reduce((t, [s, e]) => t + (e - s), 0);
    if (ms > 0) summary.sleepHours = Math.round((ms / 3_600_000) * 10) / 10;

    // Per-stage breakdown. Sum each stage's duration across all sessions.
    // Within a single Health Connect SleepSession, stages don't overlap by
    // construction, so direct summing is safe (mirrors how appleHealth.ts
    // treats per-stage HKCategoryTypeIdentifierSleepAnalysis values).
    const stages: SleepStages = {
      asleepUnspecifiedMinutes: 0,
      deepMinutes: 0,
      remMinutes: 0,
      coreMinutes: 0,
      awakeMinutes: 0,
    };
    const minutesBetween = (a: string, b: string) =>
      Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60_000);
    for (const session of sleep.records) {
      for (const stage of session.stages ?? []) {
        const m = minutesBetween(stage.startTime, stage.endTime);
        switch (stage.stage) {
          case STAGE_SLEEPING:
            stages.asleepUnspecifiedMinutes += m;
            break;
          case STAGE_AWAKE:
            stages.awakeMinutes += m;
            break;
          case STAGE_AWAKE_IN_BED:
            stages.awakeMinutes += m;
            break;
          case STAGE_LIGHT:
            stages.coreMinutes += m;
            break;
          case STAGE_DEEP:
            stages.deepMinutes += m;
            break;
          case STAGE_REM:
            stages.remMinutes += m;
            break;
        }
      }
    }
    if (merged.length > 0) {
      const r = (m: number) => Math.round(m);
      summary.sleepStages = {
        asleepUnspecifiedMinutes: r(stages.asleepUnspecifiedMinutes),
        deepMinutes: r(stages.deepMinutes),
        remMinutes: r(stages.remMinutes),
        coreMinutes: r(stages.coreMinutes),
        awakeMinutes: r(stages.awakeMinutes),
      };
    }
  } catch {}

  // Steps — aggregated total for the day.
  try {
    const steps = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: dayFilter,
    });
    if (typeof steps.COUNT_TOTAL === 'number' && steps.COUNT_TOTAL > 0) {
      summary.steps = Math.round(steps.COUNT_TOTAL);
    }
  } catch {}

  // Active energy. Health Connect aggregates wrap the value in a
  // recordType-specific key (ACTIVE_CALORIES_TOTAL) whose value is a
  // multi-unit EnergyResult.
  try {
    const energy = await aggregateRecord({
      recordType: 'ActiveCaloriesBurned',
      timeRangeFilter: dayFilter,
    });
    const kcal = energy.ACTIVE_CALORIES_TOTAL?.inKilocalories;
    if (typeof kcal === 'number' && kcal > 0) {
      summary.activeEnergyKcal = Math.round(kcal);
    }
  } catch {}

  // Walking + running distance. Health Connect's Distance record covers
  // all movement — there's no equivalent of HealthKit's separate
  // "DistanceWalkingRunning". For Cadence's daily tile the all-up daily
  // distance is the closer match anyway. Same wrapper pattern as energy.
  try {
    const distance = await aggregateRecord({
      recordType: 'Distance',
      timeRangeFilter: dayFilter,
    });
    const meters = distance.DISTANCE?.inMeters;
    if (typeof meters === 'number' && meters > 0) {
      summary.distanceMeters = Math.round(meters);
    }
  } catch {}

  // Resting heart rate — single most-recent sample in the day.
  try {
    const rhr = await readRecords('RestingHeartRate', {
      timeRangeFilter: dayFilter,
      ascendingOrder: false,
      pageSize: 1,
    });
    const latest = rhr.records[0];
    if (latest && typeof latest.beatsPerMinute === 'number') {
      summary.restingHeartRate = Math.round(latest.beatsPerMinute);
    }
  } catch {}

  // HRV — single most-recent RMSSD sample in the day.
  // **Semantic note**: HealthKit gives SDNN; Health Connect gives RMSSD.
  // Same field name in DailySummary, different underlying metric. The
  // server-side correlation engine needs to know this (see types.ts:
  // suggested new `hrvMetric` discriminator).
  try {
    const hrv = await readRecords('HeartRateVariabilityRmssd', {
      timeRangeFilter: dayFilter,
      ascendingOrder: false,
      pageSize: 1,
    });
    const latest = hrv.records[0];
    if (latest && typeof latest.heartRateVariabilityMillis === 'number') {
      summary.hrvMs = Math.round(latest.heartRateVariabilityMillis);
    }
  } catch {}

  // Workouts (ExerciseSession). Health Connect doesn't pack distance into
  // the session record itself, so for the daily-tile case we don't fetch
  // it. The Running deep dive (readWorkoutsRange) does the join — see
  // below.
  try {
    const exercises = await readRecords('ExerciseSession', {
      timeRangeFilter: dayFilter,
    });
    summary.workouts = exercises.records.map(
      (session): WorkoutSummary => ({
        activityName: activityNameFor(session.exerciseType),
        startsAt: session.startTime,
        endsAt: session.endTime,
        durationMinutes: Math.round(
          (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60_000,
        ),
        // Daily tile: no per-session distance lookup. weekly mileage does
        // the join below.
        distanceMeters: undefined,
      }),
    );
  } catch {}

  return summary;
}

// Health Connect ExerciseType codes → Cadence activity names. The numeric
// codes are defined by the Android Health Connect SDK. Subset Cadence
// cares about:
//   8  = BIKING               (Cycling)
//   34 = HIKING               (Hike)
//   56 = RUNNING              (Run) — outdoor running. 57 is RUNNING_TREADMILL.
//   72 = SWIMMING_OPEN_WATER  (Swim) — 74 is SWIMMING_POOL.
//   79 = WALKING              (Walk)
//   83 = YOGA                 (Yoga)
// Anything else → "Workout".
function activityNameFor(exerciseType: number): string {
  switch (exerciseType) {
    case 56:
    case 57:
      return 'Run';
    case 79:
      return 'Walk';
    case 8:
      return 'Cycling';
    case 83:
      return 'Yoga';
    case 34:
      return 'Hike';
    case 72:
    case 74:
      return 'Swim';
    default:
      return 'Workout';
  }
}

// Read workouts in a range. For the Running deep dive we DO want per-run
// distance — Health Connect splits this across two record types, so we
// read both and join on the session's [startTime, endTime] window.
export async function readWorkoutsRange(start: Date, end: Date): Promise<WorkoutSummary[]> {
  if (!isAndroid) return [];
  await ensureInitialized();
  const filter = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
  try {
    const [exercises, distances] = await Promise.all([
      readRecords('ExerciseSession', {
        timeRangeFilter: filter,
        ascendingOrder: false,
      }),
      readRecords('Distance', {
        timeRangeFilter: filter,
      }),
    ]);

    return exercises.records.map((session): WorkoutSummary => {
      const s = new Date(session.startTime).getTime();
      const e = new Date(session.endTime).getTime();
      // Sum distance records that fall inside the session window. Same
      // approach Apple's HealthKit uses internally to bind HKDistance to
      // HKWorkout — we just do it on the JS side.
      const meters = distances.records.reduce((sum, rec) => {
        const rs = new Date(rec.startTime).getTime();
        const re = new Date(rec.endTime).getTime();
        if (rs >= s && re <= e) return sum + (rec.distance?.inMeters ?? 0);
        return sum;
      }, 0);
      return {
        activityName: activityNameFor(session.exerciseType),
        startsAt: session.startTime,
        endsAt: session.endTime,
        durationMinutes: Math.round((e - s) / 60_000),
        distanceMeters: meters > 0 ? Math.round(meters) : undefined,
      };
    });
  } catch {
    return [];
  }
}

export type { DailySummary, HealthAuthStatus, WorkoutSummary };
