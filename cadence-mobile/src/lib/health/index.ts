export {
  isAvailable,
  isAuthorized,
  getStatus,
  requestPermissions,
  readDailySummary,
  readWorkoutsRange,
  HealthKitError,
} from './appleHealth';
export {
  importHistoricalHealth,
  hasCompleted as hasHistoricalImportCompleted,
  clearCompletion as clearHistoricalImport,
  DEFAULT_IMPORT_DAYS,
} from './import';
export type { ImportResult, ImportProgress } from './import';
export { detectFromSummary } from './autodetect';
export type { AutodetectMatch } from './autodetect';
export { readHeartRateForWorkout, DEFAULT_MAX_HR } from './heartRate';
export type { HeartRateZoneBreakdown } from './heartRate';
export { readWorkoutRoute } from './workoutRoute';
export type { RoutePoint } from './workoutRoute';
export type {
  DailySummary,
  HealthAuthStatus,
  SleepStages,
  WorkoutSummary,
} from './types';
