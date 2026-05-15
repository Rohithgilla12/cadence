// Android stub for the iOS heartRate.ts module. Returns null so the
// Running deep dive's HR zone tile renders the "no heart-rate data"
// empty state without touching any native module.
//
// A real Android port reads Health Connect HeartRateRecord across the
// workout's [startTime, endTime] window:
//
//   const result = await readRecords('HeartRate', {
//     timeRangeFilter: { operator: 'between', startTime, endTime },
//   });
//   const samples = result.records.flatMap(r =>
//     r.samples.map(s => ({ bpm: s.beatsPerMinute, at: new Date(s.time) }))
//   );
//
// Then run the same zone-classification logic that heartRate.ts uses.
// Deferring the port to a follow-up — the daily-summary + workouts
// surface is the wedge; per-run HR zones are a Running-deep-dive
// nicety that v1 Android can ship without.

import { DEFAULT_MAX_HR } from '@/lib/settings';
import type { HeartRateZoneBreakdown } from './heartRate';

export { DEFAULT_MAX_HR };
export type { HeartRateZoneBreakdown };

export async function readHeartRateForWorkout(
  _startsAt: string,
  _endsAt: string,
  _maxHr: number = DEFAULT_MAX_HR,
): Promise<HeartRateZoneBreakdown | null> {
  return null;
}
