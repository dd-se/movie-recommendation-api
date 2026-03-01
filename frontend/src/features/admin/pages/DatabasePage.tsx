import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { adminApi } from '@/api/admin';
import type { BackupItem } from '../types';
import { useAdminToken } from '../hooks/useAdminToken';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DatabasePage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery<BackupItem[]>({
    queryKey: ['admin', 'backups'],
    queryFn: () => adminApi.getBackups(token),
    enabled: !!token,
  });

  const backupMutation = useMutation({
    mutationFn: () => adminApi.createBackup(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(data.detail, { description: data.filename });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => adminApi.syncQueue(token),
    onSuccess: (data) => {
      toast.success(data.detail);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Database Administration</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" />
              Database Backup
            </CardTitle>
            <CardDescription>Create a timestamped SQLite backup</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => backupMutation.mutate()} disabled={backupMutation.isPending} className="w-full">
              {backupMutation.isPending ? 'Creating…' : 'Create Backup'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync Queue
            </CardTitle>
            <CardDescription>Ensure every movie has a queue entry</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="w-full">
              {syncMutation.isPending ? 'Syncing…' : 'Sync Movie Queue'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Available Backups
            {backups && <span className="text-muted-foreground font-normal">({backups.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : backups && backups.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.filename}>
                      <TableCell className="font-mono text-sm">{b.filename}</TableCell>
                      <TableCell>{formatBytes(b.size_bytes)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(b.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No backups found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
