import { Platform } from 'react-native';
import { queryWorkoutSamples } from '@kingstinct/react-native-healthkit';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  speedMetersPerSecond?: number;
  at: Date;
}

// Looks up the workout whose start_date matches startsAtIso, then unrolls its
// HKWorkoutRoute samples into a flat array of GPS points sorted by time.
//
// A single workout can have multiple route samples (e.g. paused + resumed),
// so we concatenate them in time order rather than picking just the first.
// Returns an empty array when the user is missing the workout-route HealthKit
// permission, the run was indoors, or no route was recorded by the device.
export async function readWorkoutRoute(startsAtIso: string): Promise<RoutePoint[]> {
  if (Platform.OS !== 'ios') return [];
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return [];

  // Query a tight window around the run's start to find its WorkoutProxy.
  // queryWorkoutSamples returns proxies on which we can call getWorkoutRoutes.
  const startWindow = new Date(startsAt.getTime() - 60 * 1000);
  const endWindow = new Date(startsAt.getTime() + 60 * 1000);

  let proxies: ReadonlyArray<{ startDate: Date; getWorkoutRoutes(): Promise<ReadonlyArray<{ locations: ReadonlyArray<{ latitude: number; longitude: number; altitude: number; speed: number; date: Date }> }>> }> = [];
  try {
    proxies = await queryWorkoutSamples({
      limit: -1,
      ascending: true,
      filter: { date: { startDate: startWindow, endDate: endWindow } },
    });
  } catch {
    return [];
  }
  const proxy = proxies.find((p) => p.startDate.getTime() === startsAt.getTime());
  if (!proxy) return [];

  let routes: ReadonlyArray<{ locations: ReadonlyArray<{ latitude: number; longitude: number; altitude: number; speed: number; date: Date }> }> = [];
  try {
    routes = await proxy.getWorkoutRoutes();
  } catch {
    return [];
  }

  const points: RoutePoint[] = [];
  for (const route of routes) {
    for (const loc of route.locations) {
      points.push({
        latitude: loc.latitude,
        longitude: loc.longitude,
        altitudeMeters: loc.altitude,
        speedMetersPerSecond: loc.speed,
        at: loc.date,
      });
    }
  }
  points.sort((a, b) => a.at.getTime() - b.at.getTime());
  return points;
}
