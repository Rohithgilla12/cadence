export type PillarId =
  | 'movement'
  | 'rest'
  | 'mind'
  | 'mood'
  | 'nourish'
  | 'practice';

export interface PillarOption {
  id: PillarId;
  label: string;
  description: string;
}

export const PILLAR_OPTIONS: PillarOption[] = [
  { id: 'movement', label: 'Movement', description: 'Running, walking, training.' },
  { id: 'rest', label: 'Rest', description: 'Sleep, recovery, quiet.' },
  { id: 'mind', label: 'Mind', description: 'Focus, meditation, attention.' },
  { id: 'mood', label: 'Mood', description: 'Noticing how you feel.' },
  { id: 'nourish', label: 'Nourish', description: 'Hydration, eating well.' },
  { id: 'practice', label: 'Practice', description: 'Reading, writing, learning.' },
];
