import { Platform } from 'react-native';

import type { DailySummary, HealthAuthStatus, WorkoutSummary } from './types';
import { READ_SAMPLE_TYPES } from './permissions';

const isIOS = Platform.OS === 'ios';

// v14 of @kingstinct/react-native-healthkit uses Nitro modules and a modular API
// surface that is fundamentally different from the v9 API the plan was authored
// against. Key changes:
//
//   - No single default export. Functions live on named module objects (Core,
//     CategoryTypes, QuantityTypes, Workouts) imported from the package.
//   - requestAuthorization({ toRead, toShare }) — not ([], reads[]).
//   - getRequestStatusForAuthorization({ toRead }) — returns AuthorizationRequestStatus
//     enum (0=unknown, 1=shouldRequest, 2=unnecessary), not a string.
//   - queryCategorySamples(id, { limit, filter: { date: { startDate, endDate } } })
//   - queryStatisticsForQuantity(id, stats, { filter: { date: { startDate, endDate } } })
//   - queryWorkoutSamples({ limit, filter: { date: { startDate, endDate } } })
//   - WorkoutProxy.workoutActivityType is the WorkoutActivityType enum, and
//     .duration is a Quantity ({ unit, quantity }) — not a raw number.
//
// The exported surface (isAvailable, isAuthorized, getStatus, requestPermissions,
// readDailySummary) is unchanged from the plan.

// Minimal local interface for the v14 module objects we use.
// Casting through this keeps the non-iOS import conditional and avoids any.
interface HealthkitModules {
  Core: {
    isHealthDataAvailable(): boolean;
    getRequestStatusForAuthorization(toCheck: {
      toRead?: readonly string[];
      toShare?: readonly string[];
    }): Promise<number>;
    requestAuthorization(toRequest: {
      toRead?: readonly string[];
      toShare?: readonly string[];
    }): Promise<boolean>;
  };
  CategoryTypes: {
    queryCategorySamples(
      identifier: string,
      options: {
        limit: number;
        ascending?: boolean;
        filter?: { date?: { startDate?: Date; endDate?: Date } };
      },
    ): Promise<ReadonlyArray<{
      startDate: Date;
      endDate: Date;
      value: number;
    }>>;
  };
  QuantityTypes: {
    queryStatisticsForQuantity(
      identifier: string,
      statistics: readonly string[],
      options?: {
        filter?: { date?: { startDate?: Date; endDate?: Date } };
      },
    ): Promise<{ sumQuantity?: { unit: string; quantity: number } }>;
  };
  Workouts: {
    queryWorkoutSamples(options: {
      limit: number;
      ascending?: boolean;
      filter?: { date?: { startDate?: Date; endDate?: Date } };
    }): Promise<ReadonlyArray<{
      workoutActivityType: number;
      startDate: Date;
      endDate: Date;
      duration: { unit: string; quantity: number };
      totalDistance?: { unit: string; quantity: number };
    }>>;
  };
}

function isHealthkitLibrary(value: unknown): value is {
  Core: HealthkitModules['Core'];
  CategoryTypes: HealthkitModules['CategoryTypes'];
  QuantityTypes: HealthkitModules['QuantityTypes'];
  Workouts: HealthkitModules['Workouts'];
} {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['Core'] === 'object' && candidate['Core'] !== null &&
    typeof candidate['CategoryTypes'] === 'object' && candidate['CategoryTypes'] !== null &&
    typeof candidate['QuantityTypes'] === 'object' && candidate['QuantityTypes'] !== null &&
    typeof candidate['Workouts'] === 'object' && candidate['Workouts'] !== null
  );
}

async function loadHealthkitModules(): Promise<HealthkitModules | null> {
  if (!isIOS) return null;
  try {
    // Dynamic import so non-iOS bundles never load the Nitro native module.
    const lib: unknown = await import('@kingstinct/react-native-healthkit');
    if (!isHealthkitLibrary(lib)) return null;
    return {
      Core: lib.Core,
      CategoryTypes: lib.CategoryTypes,
      QuantityTypes: lib.QuantityTypes,
      Workouts: lib.Workouts,
    };
  } catch {
    return null;
  }
}

// AuthorizationRequestStatus.unnecessary === 2 in v14
const AUTHORIZATION_REQUEST_STATUS_UNNECESSARY = 2;

export function isAvailable(): boolean {
  return isIOS;
}

export async function isAuthorized(): Promise<boolean> {
  const modules = await loadHealthkitModules();
  if (!modules) return false;
  try {
    const status = await modules.Core.getRequestStatusForAuthorization({
      toRead: READ_SAMPLE_TYPES as unknown as readonly string[],
    });
    return status === AUTHORIZATION_REQUEST_STATUS_UNNECESSARY;
  } catch {
    return false;
  }
}

export async function getStatus(): Promise<HealthAuthStatus> {
  if (!isIOS) return 'unavailable';
  return (await isAuthorized()) ? 'authorized' : 'unknown';
}

export class HealthKitError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'HealthKitError';
  }
}

export async function requestPermissions(): Promise<HealthAuthStatus> {
  const modules = await loadHealthkitModules();
  if (!modules) {
    if (!isIOS) return 'unavailable';
    // iOS but native module didn't load — almost certainly an entitlement /
    // capability problem in the build. Throw so the caller can show the real
    // reason instead of a generic 'denied'.
    throw new HealthKitError(
      'HealthKit native module failed to load. Check that the HealthKit capability is enabled for the App ID in Apple Developer Portal and that the build was provisioned with the matching profile.',
    );
  }
  try {
    await modules.Core.requestAuthorization({
      toRead: READ_SAMPLE_TYPES as unknown as readonly string[],
      toShare: [],
    });
    return (await isAuthorized()) ? 'authorized' : 'denied';
  } catch (err) {
    throw new HealthKitError(
      err instanceof Error ? err.message : 'HealthKit authorization failed',
      err,
    );
  }
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function readDailySummary(date: Date): Promise<DailySummary> {
  const summary: DailySummary = {
    date: toIsoDate(date),
    workouts: [],
  };
  const modules = await loadHealthkitModules();
  if (!modules) return summary;

  const startDate = startOfLocalDay(date);
  const endDate = endOfLocalDay(date);
  const dateFilter = { date: { startDate, endDate } };

  try {
    const sleepSamples = await modules.CategoryTypes.queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      { limit: -1, filter: dateFilter },
    );
    // CategoryValueSleepAnalysis: inBed=0, asleep/asleepUnspecified=1, awake=2,
    // asleepCore=3, asleepDeep=4, asleepREM=5. Count value >= 1 && value !== 2 as sleep time.
    const sleepMilliseconds = sleepSamples
      .filter((sample) => sample.value >= 1 && sample.value !== 2)
      .reduce((accumulated, sample) => {
        return accumulated + (sample.endDate.getTime() - sample.startDate.getTime());
      }, 0);
    if (sleepMilliseconds > 0) {
      summary.sleepHours = Math.round((sleepMilliseconds / 3_600_000) * 10) / 10;
    }
  } catch {}

  try {
    const stepsResult = await modules.QuantityTypes.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: dateFilter },
    );
    if (stepsResult?.sumQuantity?.quantity != null) {
      summary.steps = Math.round(stepsResult.sumQuantity.quantity);
    }
  } catch {}

  try {
    const energyResult = await modules.QuantityTypes.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      ['cumulativeSum'],
      { filter: dateFilter },
    );
    if (energyResult?.sumQuantity?.quantity != null) {
      summary.activeEnergyKcal = Math.round(energyResult.sumQuantity.quantity);
    }
  } catch {}

  try {
    const workouts = await modules.Workouts.queryWorkoutSamples({
      limit: -1,
      filter: dateFilter,
    });
    summary.workouts = workouts.map((workout): WorkoutSummary => ({
      activityName: activityNameFor(workout.workoutActivityType),
      startsAt: workout.startDate.toISOString(),
      endsAt: workout.endDate.toISOString(),
      // v14 duration is a Quantity { unit, quantity } where unit is seconds
      durationMinutes: Math.round(workout.duration.quantity / 60),
      distanceMeters: workout.totalDistance?.quantity,
    }));
  } catch {}

  return summary;
}

// Minimal mapping. Expand with more activity types as habits demand.
// Reference: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
// WorkoutActivityType enum values: cycling=13, hiking=24, running=37, swimming=46,
// walking=52, yoga=57
function activityNameFor(activityType: number): string {
  switch (activityType) {
    case 37: return 'Run';
    case 52: return 'Walk';
    case 13: return 'Cycling';
    case 57: return 'Yoga';
    case 24: return 'Hike';
    case 46: return 'Swim';
    default: return 'Workout';
  }
}

export type { DailySummary, HealthAuthStatus, WorkoutSummary };
