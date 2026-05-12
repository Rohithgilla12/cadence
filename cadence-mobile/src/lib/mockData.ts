import {
  IconRun,
  IconYoga,
  IconBook2,
  IconWalk,
} from '@tabler/icons-react-native';
import type { Habit, DayDot, Insight, CheckIn } from '@/types';

export const mockHabits: Habit[] = [
  {
    id: '1',
    name: 'Morning run',
    icon: 'run',
    timeOfDay: 'morning',
    target: { value: 30, unit: 'min' },
    done: true,
    streak: 12,
    source: 'strava',
    autoDetected: true,
  },
  {
    id: '2',
    name: 'Mindful 10',
    icon: 'yoga',
    timeOfDay: 'morning',
    target: { value: 10, unit: 'min' },
    done: false,
    streak: 5,
    source: 'apple_health',
  },
  {
    id: '3',
    name: 'Read fiction',
    icon: 'book-2',
    timeOfDay: 'evening',
    target: { value: 20, unit: 'min' },
    done: false,
    streak: 23,
    source: 'manual',
  },
  {
    id: '4',
    name: 'Walk after dinner',
    icon: 'walk',
    timeOfDay: 'evening',
    done: true,
    streak: 4,
    source: 'apple_health',
    autoDetected: true,
  },
];

// Week strip — today is Wednesday (index 2). M was a done day, T was quiet.
export const mockWeek: DayDot[] = [
  { date: '2026-05-11', weekday: 'M', state: 'past-done' },
  { date: '2026-05-12', weekday: 'T', state: 'past-quiet' },
  { date: '2026-05-13', weekday: 'W', state: 'today' },
  { date: '2026-05-14', weekday: 'T', state: 'future' },
  { date: '2026-05-15', weekday: 'F', state: 'future' },
  { date: '2026-05-16', weekday: 'S', state: 'future' },
  { date: '2026-05-17', weekday: 'S', state: 'future' },
];

export const mockInsight: Insight = {
  kind: 'pattern',
  renderedText: 'You run 2.3× more often after nights over 7 hours of sleep.',
  emphasis: '2.3× more often',
};

export const mockCheckIn: CheckIn = { mood: 4, sleepHours: 7.5 };

// Maps icon slugs stored on the Habit model to Tabler icon components.
// Deterministic — same slug always resolves to the same component.
export const iconFor: Record<
  string,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  run: IconRun,
  yoga: IconYoga,
  'book-2': IconBook2,
  walk: IconWalk,
};
