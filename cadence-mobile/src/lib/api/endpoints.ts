import type { ApiClient } from './client';
import type {
  ApiCheckIn,
  ApiHabit,
  GetCheckInResponse,
  ListHabitsResponse,
  Me,
} from './types';

interface CreateHabitInput {
  name: string;
  icon: string;
  timeOfDay?: ApiHabit['timeOfDay'];
  target?: ApiHabit['target'];
  trackContext?: boolean;
}

export const endpoints = {
  getMe: (client: ApiClient) => () => client.request<Me>('/v1/me'),

  listHabits: (client: ApiClient) => () =>
    client.request<ListHabitsResponse>('/v1/habits').then((r) => r.habits),

  createHabit: (client: ApiClient) => (input: CreateHabitInput) =>
    client
      .request<{ habit: ApiHabit }>('/v1/habits', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      .then((r) => r.habit),

  toggleHabit: (client: ApiClient) => (habitId: string) =>
    client
      .request<{ habit: ApiHabit }>(`/v1/habits/${habitId}/toggle`, {
        method: 'POST',
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
