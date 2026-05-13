import { Platform } from 'react-native';
import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import type { DailySummary, HealthAuthStatus, SleepStages, WorkoutSummary } from './types';
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

// "Last night's sleep" window: 6pm of the previous calendar day to 11am of the
// given day. Naps later in the day are intentionally excluded — the home tile
// is about overnight rhythm. Most sleep sessions fall entirely within this
// window; an outlier (shift worker, transatlantic flight) would simply not
// show, which we prefer to surfacing a misleading number.
function lastNightWindow(date: Date): { startDate: Date; endDate: Date } {
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 18, 0, 0, 0);
  const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11, 0, 0, 0);
  return { startDate, endDate };
}

// Merge overlapping [start, end] intervals into a deduplicated set. HealthKit
// often returns multiple overlapping sleep samples (e.g. Apple Watch logs a
// top-level "asleep" interval AND stage-specific "asleepCore/Deep/REM"
// intervals covering the same time). Summing those without merging
// triple-counts the same minutes — that's how a real 7h night becomes 14h.
function mergeIntervals(intervals: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = sorted[i];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
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
    const sleepWindow = lastNightWindow(date);
    const sleepSamples = await queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      { limit: -1, filter: { date: sleepWindow } },
    );
    // CategoryValueSleepAnalysis: inBed=0, asleepUnspecified=1, awake=2,
    // asleepCore=3, asleepDeep=4, asleepREM=5. Total sleep = any value >= 1
    // except 2. Merge intervals before summing — Apple Watch produces
    // overlapping samples (top-level asleep + per-stage core/deep/REM) that
    // would otherwise double-count.
    const sleepIntervals: Array<[number, number]> = sleepSamples
      .filter((sample) => sample.value >= 1 && sample.value !== 2)
      .map((sample) => [sample.startDate.getTime(), sample.endDate.getTime()]);
    const mergedIntervals = mergeIntervals(sleepIntervals);
    const sleepMilliseconds = mergedIntervals.reduce(
      (total, [start, end]) => total + (end - start),
      0,
    );
    if (sleepMilliseconds > 0) {
      summary.sleepHours = Math.round((sleepMilliseconds / 3_600_000) * 10) / 10;
    }

    // Per-stage breakdown. Stages (3/4/5) don't overlap within a single
    // source, so summing each value's intervals directly is safe — and
    // sums independently from the merged "all sleep" total above.
    const stages: SleepStages = {
      asleepUnspecifiedMinutes: 0,
      deepMinutes: 0,
      remMinutes: 0,
      coreMinutes: 0,
      awakeMinutes: 0,
    };
    const minutesBetween = (start: Date, end: Date) =>
      Math.max(0, (end.getTime() - start.getTime()) / 60_000);
    for (const sample of sleepSamples) {
      const minutes = minutesBetween(sample.startDate, sample.endDate);
      if (sample.value === 1) stages.asleepUnspecifiedMinutes += minutes;
      else if (sample.value === 2) stages.awakeMinutes += minutes;
      else if (sample.value === 3) stages.coreMinutes += minutes;
      else if (sample.value === 4) stages.deepMinutes += minutes;
      else if (sample.value === 5) stages.remMinutes += minutes;
    }
    const roundMinutes = (m: number) => Math.round(m);
    if (mergedIntervals.length > 0) {
      summary.sleepStages = {
        asleepUnspecifiedMinutes: roundMinutes(stages.asleepUnspecifiedMinutes),
        deepMinutes: roundMinutes(stages.deepMinutes),
        remMinutes: roundMinutes(stages.remMinutes),
        coreMinutes: roundMinutes(stages.coreMinutes),
        awakeMinutes: roundMinutes(stages.awakeMinutes),
      };
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
    const distanceResult = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierDistanceWalkingRunning',
      ['cumulativeSum'],
      { filter: dateFilter },
    );
    if (distanceResult?.sumQuantity?.quantity != null) {
      // Default unit for distance quantities is meters.
      summary.distanceMeters = Math.round(distanceResult.sumQuantity.quantity);
    }
  } catch {}

  // Resting heart rate and HRV are sampled, not cumulative. mostRecent gives
  // us today's freshest reading.
  try {
    const rhrResult = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierRestingHeartRate',
      ['mostRecent'],
      { filter: dateFilter },
    );
    const recent = (rhrResult as { mostRecentQuantity?: { quantity: number } })
      ?.mostRecentQuantity;
    if (recent?.quantity != null) {
      summary.restingHeartRate = Math.round(recent.quantity);
    }
  } catch {}

  try {
    const hrvResult = await queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      ['mostRecent'],
      { filter: dateFilter },
    );
    const recent = (hrvResult as { mostRecentQuantity?: { quantity: number } })
      ?.mostRecentQuantity;
    if (recent?.quantity != null) {
      // HRV SDNN reports in seconds — multiply for ms which is what humans
      // recognize (e.g. "42 ms").
      summary.hrvMs = Math.round(recent.quantity * 1000);
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
