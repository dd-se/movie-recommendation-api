import type { AuthToken, Movie, MovieFilter, User } from './types';

const BASE = '';

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const msg =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d: { msg: string }) => d.msg).join(', ')
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  signup(email: string, password: string) {
    return request<User>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string, scopes = 'movie:read') {
    const params = new URLSearchParams({
      username: email,
      password,
      scope: scopes,
    });
    return request<AuthToken>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  },

  whoami(token: string) {
    return request<User>('/auth/whoami', {
      headers: authHeaders(token),
    });
  },

  getMovies(endpoint: string, filter: MovieFilter, token?: string) {
    return request<Movie[]>(endpoint, {
      method: 'POST',
      headers: token ? authHeaders(token) : {},
      body: JSON.stringify(filter),
    });
  },

  forgetRecommendations(token: string) {
    return request<{ detail: string }>('/v2/user/forget-recommends', {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  health() {
    return request<{ status: string }>('/api/health');
  },
};
