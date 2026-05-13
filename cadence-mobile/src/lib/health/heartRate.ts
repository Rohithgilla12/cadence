import { Platform } from 'react-native';
import { queryQuantitySamples } from '@kingstinct/react-native-healthkit';

// HR zone model. Until we collect the user's max HR explicitly (PRD §6
// running mode + settings, future work), assume a max of 190 bpm — fair
// default for adult runners in their 20s-30s. Zones can be re-derived
// trivially once max_hr lands on the user record.
export const DEFAULT_MAX_HR = 190;

export interface HeartRateSample {
  bpm: number;
  at: Date;
}

export interface HeartRateZoneBreakdown {
  // Seconds spent in each zone, indexed 0..4 for Z1..Z5.
  secondsInZone: [number, number, number, number, number];
  averageBpm: number;
  minBpm: number;
  maxBpm: number;
  sampleCount: number;
}

// Cumulative zone boundaries as fractions of max HR. Z1=<60%, Z2=60–70%,
// Z3=70–80%, Z4=80–90%, Z5=>=90%. Standard 5-zone running model.
const ZONE_UPPER_FRACTIONS: ReadonlyArray<number> = [0.6, 0.7, 0.8, 0.9, Infinity];

function zoneFor(bpm: number, maxHr: number): number {
  const fraction = bpm / maxHr;
  for (let i = 0; i < ZONE_UPPER_FRACTIONS.length; i++) {
    if (fraction < ZONE_UPPER_FRACTIONS[i]) return i;
  }
  return ZONE_UPPER_FRACTIONS.length - 1;
}

export async function readHeartRateForWorkout(
  startsAt: string,
  endsAt: string,
  maxHr: number = DEFAULT_MAX_HR,
): Promise<HeartRateZoneBreakdown | null> {
  if (Platform.OS !== 'ios') return null;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  let samples: ReadonlyArray<{ startDate: Date; endDate: Date; quantity: number }> = [];
  try {
    samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: -1,
      ascending: true,
      filter: { date: { startDate: start, endDate: end } },
      unit: 'count/min',
    });
  } catch {
    return null;
  }

  if (samples.length === 0) return null;

  const secondsInZone: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let totalBpm = 0;
  let minBpm = Number.POSITIVE_INFINITY;
  let maxBpm = 0;

  // Each sample represents an instantaneous reading. We treat the duration
  // each reading "covers" as the gap to the next sample (or to the workout
  // end for the last one). This gives a continuous time-in-zone breakdown
  // without assuming a fixed sampling rate.
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const bpm = sample.quantity;
    totalBpm += bpm;
    if (bpm < minBpm) minBpm = bpm;
    if (bpm > maxBpm) maxBpm = bpm;
    const nextStart = i + 1 < samples.length ? samples[i + 1].startDate : end;
    const elapsedMs = Math.max(0, nextStart.getTime() - sample.startDate.getTime());
    const zone = zoneFor(bpm, maxHr);
    secondsInZone[zone] += elapsedMs / 1000;
  }

  return {
    secondsInZone,
    averageBpm: Math.round(totalBpm / samples.length),
    minBpm: Math.round(minBpm),
    maxBpm: Math.round(maxBpm),
    sampleCount: samples.length,
  };
}
