import {
  IconRun,
  IconYoga,
  IconBook2,
  IconWalk,
} from '@tabler/icons-react-native';
import type { DayDot, Insight } from '@/types';

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
