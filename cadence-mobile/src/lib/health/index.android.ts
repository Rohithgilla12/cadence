// Android counterpart to index.ts. Metro's platform-extension resolution
// picks this file when bundling for Android; the iOS bundle uses the
// suffix-less index.ts. Same export surface either way — the 11 call
// sites that import from `@/lib/health` don't know or care.
//
// Each line below mirrors a line in index.ts but sources the
// implementation from the Android-side files (healthConnect.ts and the
// .android.ts stubs). Pure modules (autodetect, types, import) come
// from the same files iOS uses — they don't touch native at all.

export {
  isAvailable,
  isAuthorized,
  getStatus,
  requestPermissions,
  readDailySummary,
  readWorkoutsRange,
  HealthKitError,
} from './healthConnect';
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
export type { DailySummary, HealthAuthStatus, SleepStages, WorkoutSummary } from './types';
