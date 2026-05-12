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

export interface ApiHabit {
  id: string;
  name: string;
  icon: string;
  timeOfDay: ApiTimeOfDay;
  target?: ApiTarget;
  trackContext: boolean;
  doneToday: boolean;
  streak: number;
  autoDetected: boolean;
  createdAt: string;
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
