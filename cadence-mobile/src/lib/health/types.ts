export type HealthAuthStatus = 'unavailable' | 'unknown' | 'authorized' | 'denied';

export interface SleepStages {
  // Minutes per HKCategoryValueSleepAnalysis stage for last night's session.
  // Pre-iOS 16 watches only emit asleepUnspecified, so the breakdown may be
  // unspecified-only with deep/REM/core all zero.
  asleepUnspecifiedMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  coreMinutes: number;
  awakeMinutes: number;
}

export interface DailySummary {
  date: string;            // YYYY-MM-DD, local timezone
  sleepHours?: number;
  sleepStages?: SleepStages;
  steps?: number;
  activeEnergyKcal?: number;
  // Total walking + running distance for the day in meters (from
  // HKQuantityTypeIdentifierDistanceWalkingRunning). Independent of any
  // logged workout — it picks up casual walking the watch caught too.
  distanceMeters?: number;
  // Single most-recent resting heart rate sample (HKQuantityTypeIdentifierRestingHeartRate).
  restingHeartRate?: number; // beats per minute
  // Single most-recent HRV SDNN sample for the day window (HKQuantityTypeIdentifierHeartRateVariabilitySDNN).
  hrvMs?: number; // milliseconds
  workouts: WorkoutSummary[];
}

export interface WorkoutSummary {
  activityName: string;    // e.g., 'Run', 'Yoga', 'Walk'
  startsAt: string;        // ISO
  endsAt: string;          // ISO
  durationMinutes: number;
  distanceMeters?: number;
}
