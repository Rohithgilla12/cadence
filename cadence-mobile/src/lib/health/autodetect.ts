import type { ApiHabitSourceLink, HabitTimeWindow } from '@/lib/api/types';

import type { DailySummary, WorkoutSummary } from './types';

// Map our normalized activity slug to the Apple HealthKit activity name we
// store on each WorkoutSummary. Cadence keeps its own slug ("run", "walk",
// "cycling", ...) so the same SourceLink can drive Strava and Health Connect
// later — those use different activity-type vocabularies. The activityName
// strings here mirror what readDailySummary writes via activityNameFor in
// appleHealth.ts; keep them in sync.
const WORKOUT_ALIASES: Record<string, ReadonlyArray<string>> = {
  run: ['Run'],
  walk: ['Walk'],
  cycling: ['Cycling'],
  yoga: ['Yoga'],
  hike: ['Hike'],
  swim: ['Swim'],
};

function matchesActivity(slug: string, activityName: string): boolean {
  const aliases = WORKOUT_ALIASES[slug.toLowerCase()];
  if (!aliases) return false;
  return aliases.includes(activityName);
}

function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isInWindow(startsAt: string, window: HabitTimeWindow): boolean {
  const start = parseHHMM(window.start);
  const end = parseHHMM(window.end);
  if (start === null || end === null) return true; // malformed window → don't filter
  const sessionStart = new Date(startsAt);
  const localMinutes = sessionStart.getHours() * 60 + sessionStart.getMinutes();
  if (start <= end) {
    return localMinutes >= start && localMinutes <= end;
  }
  // Window wraps midnight (e.g. 21:00 - 05:00) — match either side.
  return localMinutes >= start || localMinutes <= end;
}

function workoutMatchesLink(workout: WorkoutSummary, link: ApiHabitSourceLink): boolean {
  if (!matchesActivity(link.activity, workout.activityName)) return false;
  if (link.minMinutes !== undefined && workout.durationMinutes < link.minMinutes) {
    return false;
  }
  if (link.window && !isInWindow(workout.startsAt, link.window)) return false;
  return true;
}

// Hooks for category-source rules. PRD §9 example: "Morning meditation" =
// Apple Health mindful session 5+ min between 5am-11am. readDailySummary
// doesn't surface mindful sessions yet — when it does, this branch will check
// against summary.mindfulMinutes / .mindfulSessions in the same shape.
function categoryMatches(_link: ApiHabitSourceLink, _summary: DailySummary): boolean {
  return false;
}

export interface AutodetectMatch {
  matched: boolean;
}

export function detectFromSummary(
  link: ApiHabitSourceLink,
  summary: DailySummary | undefined,
): AutodetectMatch {
  if (!summary) return { matched: false };
  if (link.provider !== 'apple_health') return { matched: false };

  if (link.kind === 'workout') {
    const matched = summary.workouts.some((workout) => workoutMatchesLink(workout, link));
    return { matched };
  }
  if (link.kind === 'category') {
    return { matched: categoryMatches(link, summary) };
  }
  return { matched: false };
}
