export {
  isAvailable,
  isAuthorized,
  getStatus,
  requestPermissions,
  readDailySummary,
  readWorkoutsRange,
  HealthKitError,
} from './appleHealth';
export { detectFromSummary } from './autodetect';
export type { AutodetectMatch } from './autodetect';
export { readHeartRateForWorkout, DEFAULT_MAX_HR } from './heartRate';
export type { HeartRateZoneBreakdown } from './heartRate';
export type {
  DailySummary,
  HealthAuthStatus,
  SleepStages,
  WorkoutSummary,
} from './types';
