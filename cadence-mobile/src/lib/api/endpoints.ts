import type { ApiClient } from './client';
import type {
  ApiCheckIn,
  ApiCircle,
  ApiCircleDetail,
  ApiHabit,
  ApiHabitSourceLink,
  ApiInsight,
  ApiTarget,
  ApiTimeOfDay,
  GetCheckInResponse,
  ListHabitsResponse,
  Me,
  UpdateMeInput,
} from './types';

interface CreateHabitInput {
  name: string;
  icon: string;
  timeOfDay?: ApiTimeOfDay;
  target?: ApiTarget;
  sourceLink?: ApiHabitSourceLink;
  trackContext?: boolean;
}

// Mirrors the Go updateHabitRequest. Omitted fields are left untouched;
// clearTarget / clearSourceLink explicitly set the column to NULL.
interface UpdateHabitInput {
  name?: string;
  icon?: string;
  timeOfDay?: ApiTimeOfDay;
  target?: ApiTarget;
  clearTarget?: boolean;
  sourceLink?: ApiHabitSourceLink;
  clearSourceLink?: boolean;
  trackContext?: boolean;
}

export type ToggleSource = 'manual' | 'apple_health' | 'health_connect' | 'strava';

export const endpoints = {
  getMe: (client: ApiClient) => () => client.request<Me>('/v1/me'),

  updateMe: (client: ApiClient) => (input: UpdateMeInput) =>
    client.request<Me>('/v1/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  listHabits: (client: ApiClient) => () =>
    client.request<ListHabitsResponse>('/v1/habits').then((r) => r.habits),

  createHabit: (client: ApiClient) => (input: CreateHabitInput) =>
    client
      .request<{ habit: ApiHabit }>('/v1/habits', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      .then((r) => r.habit),

  updateHabit: (client: ApiClient) => (habitId: string, input: UpdateHabitInput) =>
    client
      .request<{ habit: ApiHabit }>(`/v1/habits/${habitId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
      .then((r) => r.habit),

  toggleHabit: (client: ApiClient) => (habitId: string, source: ToggleSource = 'manual') =>
    client
      .request<{ habit: ApiHabit }>(`/v1/habits/${habitId}/toggle`, {
        method: 'POST',
        body: source === 'manual' ? undefined : JSON.stringify({ source }),
      })
      .then((r) => r.habit),

  archiveHabit: (client: ApiClient) => (habitId: string) =>
    client.request<void>(`/v1/habits/${habitId}`, { method: 'DELETE' }),

  getCheckIn: (client: ApiClient) => (date: string) =>
    client
      .request<GetCheckInResponse>(`/v1/check-ins/${date}`)
      .then((r) => r.checkIn),

  putCheckIn: (client: ApiClient) => (date: string, body: Partial<Omit<ApiCheckIn, 'date'>>) =>
    client
      .request<{ checkIn: ApiCheckIn }>(`/v1/check-ins/${date}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      .then((r) => r.checkIn),

  putDailySummary: (client: ApiClient) => (date: string, body: DailySummaryUpload) =>
    client.request<{ dailySummary: ApiDailySummary }>(`/v1/daily-summaries/${date}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Returns the rotated insight for Today (or null when none eligible — show
  // 'Cadence is listening' per PRD §8). Server stamps shown_at so calling
  // this advances the rotation.
  getInsightToday: (client: ApiClient) => () =>
    client.request<{ insight: ApiInsight | null }>('/v1/insights/today').then((r) => r.insight),

  // All above-threshold insights for the Reflect grid, ordered by effect
  // size descending. Doesn't advance the rotation.
  listInsights: (client: ApiClient) => () =>
    client.request<{ insights: ApiInsight[] }>('/v1/insights').then((r) => r.insights),

  computeInsights: (client: ApiClient) => () =>
    client.request<{ surfaced: number }>('/v1/insights/compute', { method: 'POST' }),

  listCircles: (client: ApiClient) => () =>
    client.request<{ circles: ApiCircle[] }>('/v1/circles').then((r) => r.circles),

  createCircle: (client: ApiClient) => (input: { name: string; description?: string }) =>
    client
      .request<{ circle: ApiCircle }>('/v1/circles', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      .then((r) => r.circle),

  getCircle: (client: ApiClient) => (id: string) =>
    client.request<ApiCircleDetail>(`/v1/circles/${id}`),

  joinCircle: (client: ApiClient) => (token: string) =>
    client
      .request<{ circle: ApiCircle }>(`/v1/circles/join/${encodeURIComponent(token)}`, {
        method: 'POST',
      })
      .then((r) => r.circle),
};

// Mirrors the Go putDailySumRequest. All fields optional — client uploads
// whatever it has and the server preserves anything not supplied.
export interface DailySummaryUpload {
  sleepHours?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepCoreMinutes?: number;
  steps?: number;
  distanceMeters?: number;
  activeEnergyKcal?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  source?: 'apple_health' | 'health_connect';
}

export interface ApiDailySummary extends DailySummaryUpload {
  date: string;
  source: 'apple_health' | 'health_connect';
  updatedAt: string;
}
