export type IntentId =
  | 'train_honestly'
  | 'calmer_day'
  | 'back_in_rhythm'
  | 'with_friends';

export interface IntentOption {
  id: IntentId;
  label: string;
  description: string;
}

// Voice anchors from PRD §20 — "rhythm", "practice", "coming back".
export const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'train_honestly',
    label: 'Train more honestly',
    description: 'Runners, athletes, anyone who wants signal over performance.',
  },
  {
    id: 'calmer_day',
    label: 'Build a calmer day',
    description: 'Mindfulness, rest, gentler mornings.',
  },
  {
    id: 'back_in_rhythm',
    label: 'Come back into rhythm',
    description: 'Returning after a quiet stretch.',
  },
  {
    id: 'with_friends',
    label: 'Try this with friends',
    description: 'A small circle holding each other to a shared practice.',
  },
];
