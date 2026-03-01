import type {
  AdminUserList,
  BackupItem,
  QueueList,
  SchedulerJob,
  SystemStats,
} from '@/features/admin/types';

const BASE = '';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Request failed (${res.status})`, res.status);
  }

  if (!res.ok) {
    const msg =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d: { msg: string }) => d.msg).join(', ')
          : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}

export const adminApi = {
  // ── Users ──────────────────────────────────────────────────────────

  getUsers(token: string, page = 1, perPage = 20, search = '') {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (search) params.set('search', search);
    return request<AdminUserList>(`/admin/users?${params}`, token);
  },

  updateScopes(token: string, userId: number, scopes: string[]) {
    return request<{ detail: string; scopes: string }>(
      `/admin/users/${userId}/scopes`,
      token,
      { method: 'PATCH', body: JSON.stringify({ scopes }) },
    );
  },

  updateStatus(token: string, userId: number, disabled: boolean) {
    return request<{ detail: string }>(
      `/admin/users/${userId}/status`,
      token,
      { method: 'PATCH', body: JSON.stringify({ disabled }) },
    );
  },

  // ── Database ───────────────────────────────────────────────────────

  createBackup(token: string) {
    return request<{ detail: string; filename: string; timestamp: string }>(
      '/admin/backup',
      token,
      { method: 'POST' },
    );
  },

  getBackups(token: string) {
    return request<BackupItem[]>('/admin/backups', token);
  },

  // ── Queue ──────────────────────────────────────────────────────────

  getQueue(token: string, page = 1, perPage = 20, status?: string) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (status) params.set('status', status);
    return request<QueueList>(`/admin/queue?${params}`, token);
  },

  refreshQueue(
    token: string,
    body: { status: string; message?: string; movie_ids?: number[] },
  ) {
    return request<{ detail: string }>('/admin/queue/refresh', token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  syncQueue(token: string) {
    return request<{ detail: string }>('/admin/sync', token);
  },

  // ── System ─────────────────────────────────────────────────────────

  getStats(token: string) {
    return request<SystemStats>('/admin/stats', token);
  },

  getScheduler(token: string) {
    return request<SchedulerJob[]>('/admin/scheduler', token);
  },

  getHealth() {
    return request<{ status: string }>('/api/health', '');
  },
};

export { ApiError };
