import type { ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit';

// Scopes per PRD §9. Read-only — no write scopes in v1.
export const READ_SAMPLE_TYPES: readonly ObjectTypeIdentifier[] = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKWorkoutTypeIdentifier',
];
