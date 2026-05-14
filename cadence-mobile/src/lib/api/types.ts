export interface Me {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  handle: string;
  intent: string;
  pillars: string[];
  onboardingCompleted: boolean;
}

export interface UpdateMeInput {
  intent?: string;
  pillars?: string[];
  displayName?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
  ) {
    super(`API ${status}: ${bodyText}`);
  }
}

export type ApiTimeOfDay = 'morning' | 'midday' | 'evening' | 'anytime';

export interface ApiTarget {
  value: number;
  unit: string;
}

// Per PRD §9 — rule for auto-detecting habit completion from a health source.
// Kept symmetric with the Go cadence-api SourceLink type so the JSON shape
// matches exactly in both directions.
export type HabitSourceProvider = 'apple_health' | 'health_connect' | 'strava';
export type HabitSourceKind = 'workout' | 'category';

export interface HabitTimeWindow {
  start: string; // "HH:MM" 24h local
  end: string;
}

export interface ApiHabitSourceLink {
  provider: HabitSourceProvider;
  kind: HabitSourceKind;
  // For 'workout': activity slug (run, walk, cycling, yoga, hike, swim).
  // For 'category': category identifier (mindful, sleep).
  activity: string;
  minMinutes?: number;
  window?: HabitTimeWindow;
}

export interface ApiHabit {
  id: string;
  name: string;
  icon: string;
  timeOfDay: ApiTimeOfDay;
  target?: ApiTarget;
  sourceLink?: ApiHabitSourceLink;
  sharedWith: string[]; // circle IDs this habit emits feed items into
  trackContext: boolean;
  doneToday: boolean;
  streak: number;
  autoDetected: boolean;
  createdAt: string;
}

export interface ApiRhythmWeekday {
  weekdayIndex: number; // 0=Mon..6=Sun
  label: string;
  completedLogs: number;
  totalSlots: number;
  completionRate: number; // 0..1
}

export interface ApiRhythm {
  windowDays: number;
  totalSlots: number;
  totalCompleted: number;
  byWeekday: ApiRhythmWeekday[];
}

export interface ApiFeedItem {
  id: string;
  circleId: string;
  userId: string;
  displayName: string;
  kind: 'habit_done' | 'pact_complete' | 'back_after_quiet';
  payload?: Record<string, unknown>;
  note?: string;
  createdAt: string;
  reactionCount: number;
  viewerReacted: boolean;
}

export interface ListHabitsResponse {
  habits: ApiHabit[];
}

export interface ApiCheckIn {
  date: string;
  mood?: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  note?: string;
}

export interface GetCheckInResponse {
  checkIn: ApiCheckIn | null;
}

export interface ApiCircle {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  inviteToken: string;
  createdAt: string;
}

export interface ApiCircleMember {
  userId: string;
  displayName: string;
  joinedAt: string;
  role: 'creator' | 'member';
}

export interface ApiCircleDetail {
  circle: ApiCircle;
  members: ApiCircleMember[];
}

export interface ApiPactProgress {
  userId: string;
  displayName: string;
  completed: boolean;
  completedAt?: string;
}

export interface ApiPact {
  id: string;
  circleId: string;
  text: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  createdBy: string;
  createdAt: string;
  linkedHabitTemplate?: Record<string, unknown>;
  progress: ApiPactProgress[];
}

// Mirrors Go insightDTO. Wraps the engine's rendered output so the UI can
// render localized copy from params later if we want, but for v1 we just
// display renderedText directly.
export interface ApiInsight {
  id: string;
  habitId?: string;
  patternType: string;
  effectSize: number;
  pValue: number;
  sampleSize: number;
  templateId: string;
  renderedText: string;
  computedAt: string;
  shownAt?: string;
  params?: Record<string, unknown>;
}
