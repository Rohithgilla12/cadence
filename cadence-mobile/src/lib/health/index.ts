export {
  isAvailable,
  isAuthorized,
  getStatus,
  requestPermissions,
  readDailySummary,
  HealthKitError,
} from './appleHealth';
export { detectFromSummary } from './autodetect';
export type { AutodetectMatch } from './autodetect';
export type {
  DailySummary,
  HealthAuthStatus,
  SleepStages,
  WorkoutSummary,
} from './types';
