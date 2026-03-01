import type { User } from '@/types';

export function hasScope(user: User | null, scope: string): boolean {
  return user?.access_token_scopes?.includes(scope) ?? false;
}

export function isAdmin(user: User | null): boolean {
  return hasScope(user, 'movie:write');
}
