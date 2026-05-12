import { ApiError } from './types';

type GetToken = () => Promise<string | null>;

interface ClientOptions {
  baseUrl: string;
  getToken: GetToken;
}

export class ApiClient {
  constructor(private readonly opts: ClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.opts.getToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(`${this.opts.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(response.status, text);
    }
    return (await response.json()) as T;
  }
}
