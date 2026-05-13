import { Platform } from 'react-native';
import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import type { DailySummary, HealthAuthStatus, WorkoutSummary } from './types';
import { READ_SAMPLE_TYPES } from './permissions';

const isIOS = Platform.OS === 'ios';

// v14 of @kingstinct/react-native-healthkit exposes flat named exports
// (requestAuthorization, queryCategorySamples, queryStatisticsForQuantity,
// queryWorkoutSamples, ...) rather than the Core/CategoryTypes/QuantityTypes
// namespace pattern from older versions. On non-iOS platforms the package
// resolves to a stub that returns safe defaults, so we don't need a runtime
// import guard — only a Platform.OS guard on functions that mutate state.

// AuthorizationRequestStatus.unnecessary === 2 in v14
const AUTHORIZATION_REQUEST_STATUS_UNNECESSARY = 2;

export class HealthKitError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'HealthKitError';
  }
}

export function isAvailable(): boolean {
  return isIOS && isHealthDataAvailable();
}

export async function isAuthorized(): Promise<boolean> {
  if (!isIOS) return false;
  try {
    const status = await getRequestStatusForAuthorization({
      toRead: READ_SAMPLE_TYPES,
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

export async function requestPermissions(): Promise<HealthAuthStatus> {
  if (!isIOS) return 'unavailable';
  try {
    await requestAuthorization({
      toRead: READ_SAMPLE_TYPES,
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
  if (!isIOS) return summary;

  const startDate = startOfLocalDay(date);
  const endDate = endOfLocalDay(date);
  const dateFilter = { date: { startDate, endDate } };

  try {
    const sleepSamples = await queryCategorySamples(
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
    const stepsResult = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: dateFilter },
    );
    if (stepsResult?.sumQuantity?.quantity != null) {
      summary.steps = Math.round(stepsResult.sumQuantity.quantity);
    }
  } catch {}

  try {
    const energyResult = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      ['cumulativeSum'],
      { filter: dateFilter },
    );
    if (energyResult?.sumQuantity?.quantity != null) {
      summary.activeEnergyKcal = Math.round(energyResult.sumQuantity.quantity);
    }
  } catch {}

  try {
    const workouts = await queryWorkoutSamples({
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
