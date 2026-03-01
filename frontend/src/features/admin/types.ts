export interface AdminUser {
  id: number;
  email: string;
  disabled: boolean;
  scopes: string;
}

export interface AdminUserList {
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}

export interface QueueItem {
  id: number;
  tmdb_id: number;
  title: string | null;
  status: string;
  retries: number;
  message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface QueueList {
  items: QueueItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface BackupItem {
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface SchedulerJob {
  job_id: string;
  name: string;
  next_run_time: string | null;
  trigger: string;
}

export interface SystemStats {
  total_movies: number;
  total_users: number;
  active_users: number;
  disabled_users: number;
  total_queue: number;
  queue_by_status: Record<string, number>;
  total_backups: number;
}

export type QueueStatusValue =
  | 'refresh_data'
  | 'preprocess_description'
  | 'create_embedding'
  | 'completed'
  | 'failed';

export const QUEUE_STATUSES: QueueStatusValue[] = [
  'refresh_data',
  'preprocess_description',
  'create_embedding',
  'completed',
  'failed',
];

export const AVAILABLE_SCOPES = ['movie:read', 'movie:write'] as const;
