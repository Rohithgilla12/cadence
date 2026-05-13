import type { ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit';

// Scopes per PRD §9. Read-only — no write scopes in v1.
export const READ_SAMPLE_TYPES: readonly ObjectTypeIdentifier[] = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKWorkoutTypeIdentifier',
  // Required to read GPS polyline samples attached to past workouts.
  // Apple gates this behind its own permission row, separate from
  // HKWorkoutTypeIdentifier — users see a second toggle in the
  // permission sheet labelled "Workout Routes."
  'HKWorkoutRouteTypeIdentifier',
];
