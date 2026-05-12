export type HealthAuthStatus = 'unavailable' | 'unknown' | 'authorized' | 'denied';

export interface DailySummary {
  date: string;            // YYYY-MM-DD, local timezone
  sleepHours?: number;
  steps?: number;
  activeEnergyKcal?: number;
  workouts: WorkoutSummary[];
}

export interface WorkoutSummary {
  activityName: string;    // e.g., 'Run', 'Yoga', 'Walk'
  startsAt: string;        // ISO
  endsAt: string;          // ISO
  durationMinutes: number;
  distanceMeters?: number;
}
