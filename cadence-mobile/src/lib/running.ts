import type { WorkoutSummary } from '@/lib/health';

// Activities the Running surface treats as "running-ish". Walks and hikes
// are excluded — they show up in the wider stats card but not here.
const RUNNING_ACTIVITIES = new Set(['Run']);

export function filterRuns(workouts: ReadonlyArray<WorkoutSummary>): WorkoutSummary[] {
  return workouts.filter((workout) => RUNNING_ACTIVITIES.has(workout.activityName));
}

// Start of the current calendar week, Monday at 00:00 local. Cadence is a
// runner-first product; weekly mileage is the universal training unit so we
// align the week to Mon-Sun rather than Sun-Sat.
export function startOfWeek(reference: Date): Date {
  const day = reference.getDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7;   // 0=Mon..6=Sun, so Mon → 0, Sun → 6
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Bucket runs by day-of-week index for the supplied week (Mon=0..Sun=6).
// Returns total meters per slot, zero for empty days.
export function dailyMetersForWeek(
  runs: ReadonlyArray<WorkoutSummary>,
  weekStart: Date,
): number[] {
  const buckets = new Array<number>(7).fill(0);
  const weekStartMs = weekStart.getTime();
  const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;
  for (const run of runs) {
    if (run.distanceMeters === undefined) continue;
    const runMs = new Date(run.startsAt).getTime();
    if (runMs < weekStartMs || runMs >= weekEndMs) continue;
    const dayIndex = Math.floor((runMs - weekStartMs) / (24 * 60 * 60 * 1000));
    if (dayIndex >= 0 && dayIndex < 7) {
      buckets[dayIndex] += run.distanceMeters;
    }
  }
  return buckets;
}

// Sum a run list's distance. Used for week and trend totals.
export function totalMeters(runs: ReadonlyArray<WorkoutSummary>): number {
  let total = 0;
  for (const run of runs) {
    if (run.distanceMeters !== undefined) total += run.distanceMeters;
  }
  return total;
}

export function formatKm(meters: number): string {
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Pace in min/km. Returns "—" when distance is too small to be meaningful.
export function formatPace(durationMinutes: number, distanceMeters?: number): string {
  if (!distanceMeters || distanceMeters < 100) return '—';
  const pacePerKm = durationMinutes / (distanceMeters / 1000);
  const wholeMinutes = Math.floor(pacePerKm);
  const seconds = Math.round((pacePerKm - wholeMinutes) * 60);
  return `${wholeMinutes}:${seconds.toString().padStart(2, '0')}/km`;
}

// Group runs into weekly mileage totals, oldest-to-newest, of length `weeks`.
// The final entry is always the current week (may still be in progress).
export function weeklyTotalsBack(
  runs: ReadonlyArray<WorkoutSummary>,
  now: Date,
  weeks: number,
): Array<{ weekStart: Date; meters: number }> {
  const currentWeekStart = startOfWeek(now);
  const buckets: Array<{ weekStart: Date; meters: number }> = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    let meters = 0;
    for (const run of runs) {
      if (run.distanceMeters === undefined) continue;
      const t = new Date(run.startsAt).getTime();
      if (t >= weekStart.getTime() && t < weekEnd.getTime()) {
        meters += run.distanceMeters;
      }
    }
    buckets.push({ weekStart, meters });
  }
  return buckets;
}

// Today's weekday index aligned with dailyMetersForWeek (Mon=0..Sun=6).
export function todayWeekdayIndex(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}
