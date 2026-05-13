import type { ApiClient } from './client';
import type {
  ApiCheckIn,
  ApiHabit,
  ApiHabitSourceLink,
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
};
