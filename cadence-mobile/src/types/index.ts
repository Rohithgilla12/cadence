import type { ApiTimeOfDay, ApiTarget } from '@/lib/api/types';

export type Mood = 1 | 2 | 3 | 4 | 5;
export type TimeOfDay = ApiTimeOfDay;
export type HabitSource = 'manual' | 'apple_health' | 'health_connect' | 'strava';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  timeOfDay: TimeOfDay;
  target?: ApiTarget;
  doneToday: boolean;
  streak: number;
  autoDetected: boolean;
}

export type DayState = 'past-done' | 'past-quiet' | 'today' | 'future';
export interface DayDot {
  date: string;
  weekday: string;
  state: DayState;
}

export type Insight =
  | { kind: 'pattern'; renderedText: string; emphasis?: string }
  | { kind: 'listening' };

export interface CheckIn {
  mood?: Mood;
  sleepHours?: number;
}
