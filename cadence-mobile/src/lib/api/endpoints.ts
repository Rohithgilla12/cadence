import type { ApiClient } from './client';
import type { Me } from './types';

export const endpoints = {
  getMe: (client: ApiClient) => () => client.request<Me>('/v1/me'),
};
