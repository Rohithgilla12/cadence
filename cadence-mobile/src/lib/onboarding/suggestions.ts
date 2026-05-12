import type { PillarId } from './pillars';

export interface SuggestedHabit {
  id: string;           // local id used only for the picker
  name: string;
  icon: string;         // matches IconPicker slugs
  timeOfDay: 'morning' | 'midday' | 'evening' | 'anytime';
}

// Two suggestions per pillar. Names are intentionally calm — the user can
// rename after creation. Slugs map to Tabler icons we already render in
// IconPicker.
const BY_PILLAR: Record<PillarId, SuggestedHabit[]> = {
  movement: [
    { id: 'mv-1', name: 'Morning run',       icon: 'run',      timeOfDay: 'morning' },
    { id: 'mv-2', name: 'Walk after dinner', icon: 'walk',     timeOfDay: 'evening' },
  ],
  rest: [
    { id: 'rs-1', name: 'Bedtime by 10pm',   icon: 'leaf',     timeOfDay: 'evening' },
    { id: 'rs-2', name: 'Stretch before bed', icon: 'yoga',    timeOfDay: 'evening' },
  ],
  mind: [
    { id: 'mn-1', name: 'Mindful 10',        icon: 'yoga',     timeOfDay: 'morning' },
    { id: 'mn-2', name: 'Quiet morning',      icon: 'sparkles', timeOfDay: 'morning' },
  ],
  mood: [
    { id: 'md-1', name: 'Mood check at noon', icon: 'sparkles', timeOfDay: 'midday' },
    { id: 'md-2', name: 'Three good things',  icon: 'pencil',   timeOfDay: 'evening' },
  ],
  nourish: [
    { id: 'nr-1', name: 'Glass of water',    icon: 'coffee',   timeOfDay: 'morning' },
    { id: 'nr-2', name: 'Eat slowly',        icon: 'sparkles', timeOfDay: 'midday' },
  ],
  practice: [
    { id: 'pr-1', name: 'Read 20 min',       icon: 'book-2',   timeOfDay: 'evening' },
    { id: 'pr-2', name: 'Write something',   icon: 'pencil',   timeOfDay: 'morning' },
  ],
};

export function suggestedHabitsFor(pillars: PillarId[]): SuggestedHabit[] {
  const set = new Map<string, SuggestedHabit>();
  for (const pillar of pillars) {
    for (const habit of BY_PILLAR[pillar] ?? []) {
      set.set(habit.id, habit);
    }
  }
  return Array.from(set.values());
}
