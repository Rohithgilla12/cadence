// Android stub for the iOS workoutRoute.ts module. Returns an empty
// array so the Running detail screen's map tile renders the "no route
// recorded" empty state without touching any native module.
//
// A real Android port reads Health Connect ExerciseSession + its
// linked ExerciseRoute sub-record:
//
//   const session = await readRecords('ExerciseSession', {
//     timeRangeFilter: { operator: 'between', startTime, endTime },
//   });
//   const route = session.records[0]?.exerciseRoute?.route ?? [];
//   return route.map(p => ({
//     latitude: p.latitude,
//     longitude: p.longitude,
//     altitudeMeters: p.altitude?.inMeters,
//     speedMetersPerSecond: undefined, // Health Connect doesn't pack speed
//     at: new Date(p.time),
//   }));
//
// Deferred to a follow-up — same reasoning as heartRate.android.ts.

import type { RoutePoint } from './workoutRoute';

export type { RoutePoint };

export async function readWorkoutRoute(_startsAtIso: string): Promise<RoutePoint[]> {
  return [];
}
