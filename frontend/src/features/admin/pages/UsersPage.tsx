import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { adminApi } from '@/api/admin';
import { AVAILABLE_SCOPES } from '../types';
import type { AdminUser, AdminUserList } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAdminToken } from '../hooks/useAdminToken';

export default function UsersPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    destructive: boolean;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', destructive: false, confirmLabel: 'Confirm', onConfirm: () => {} });

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      setDebounceTimer(
        setTimeout(() => {
          setDebouncedSearch(value);
          setPage(1);
        }, 300),
      );
    },
    [debounceTimer],
  );

  const { data, isLoading } = useQuery<AdminUserList>({
    queryKey: ['admin', 'users', page, debouncedSearch],
    queryFn: () => adminApi.getUsers(token, page, 20, debouncedSearch),
    enabled: !!token,
    placeholderData: keepPreviousData,
  });

  const scopeMutation = useMutation({
    mutationFn: ({ userId, scopes }: { userId: number; scopes: string[] }) =>
      adminApi.updateScopes(token, userId, scopes),
    onSuccess: (_result, { userId, scopes }) => {
      queryClient.setQueryData<AdminUserList>(
        ['admin', 'users', page, debouncedSearch],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((u) =>
              u.id === userId ? { ...u, scopes: scopes.join(' ') } : u,
            ),
          };
        },
      );
      toast.success('Scopes updated');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.error(err.message);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, disabled }: { userId: number; disabled: boolean }) =>
      adminApi.updateStatus(token, userId, disabled),
    onSuccess: (_result, { userId, disabled }) => {
      queryClient.setQueryData<AdminUserList>(
        ['admin', 'users', page, debouncedSearch],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((u) =>
              u.id === userId ? { ...u, disabled } : u,
            ),
          };
        },
      );
      toast.success(disabled ? 'User disabled' : 'User enabled');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.error(err.message);
    },
  });

  const toggleScope = (user: AdminUser, scope: string) => {
    const current = user.scopes.split(' ').filter(Boolean);
    const newScopes = current.includes(scope)
      ? current.filter((s) => s !== scope)
      : [...current, scope];

    if (newScopes.length === 0) {
      toast.error('At least one scope is required');
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Update Scopes',
      description: `Change scopes for ${user.email} to: ${newScopes.join(', ')}?`,
      destructive: false,
      confirmLabel: 'Update',
      onConfirm: () => {
        scopeMutation.mutate({ userId: user.id, scopes: newScopes });
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  };

  const toggleStatus = (user: AdminUser) => {
    const newDisabled = !user.disabled;
    setConfirmDialog({
      open: true,
      title: newDisabled ? 'Disable User' : 'Enable User',
      description: newDisabled
        ? `Are you sure you want to disable ${user.email}? They will lose API access.`
        : `Re-enable ${user.email}?`,
      destructive: newDisabled,
      confirmLabel: newDisabled ? 'Disable' : 'Enable',
      onConfirm: () => {
        statusMutation.mutate({ userId: user.id, disabled: newDisabled });
        setConfirmDialog((d) => ({ ...d, open: false }));
      },
    });
  };

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Users {data && <span className="text-muted-foreground font-normal">({data.total})</span>}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {AVAILABLE_SCOPES.map((scope) => {
                              const active = user.scopes.split(' ').includes(scope);
                              return (
                                <button
                                  key={scope}
                                  onClick={() => toggleScope(user, scope)}
                                  disabled={scopeMutation.isPending}
                                  className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-primary/15 text-primary border-primary/30'
                                      : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/50'
                                  }`}
                                >
                                  {scope}
                                </button>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={user.disabled ? 'disabled' : 'active'}
                            label={user.disabled ? 'Disabled' : 'Active'}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={!user.disabled}
                            onCheckedChange={() => toggleStatus(user)}
                            disabled={statusMutation.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {data?.users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        destructive={confirmDialog.destructive}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
}
