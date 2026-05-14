import {
  IconRun,
  IconYoga,
  IconBook2,
  IconWalk,
} from '@tabler/icons-react-native';
import type { Insight } from '@/types';

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
