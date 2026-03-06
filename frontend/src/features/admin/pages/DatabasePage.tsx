import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database, Download, RefreshCw, HardDrive,
  FileBox, Clock, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { adminApi } from '@/api/admin';
import type { BackupItem, SystemInfo } from '../types';
import { useAdminToken } from '../hooks/useAdminToken';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DatabasePage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery<BackupItem[]>({
    queryKey: ['admin', 'backups'],
    queryFn: () => adminApi.getBackups(token),
    enabled: !!token,
  });

  const { data: systemInfo } = useQuery<SystemInfo>({
    queryKey: ['admin', 'system-info'],
    queryFn: () => adminApi.getSystemInfo(token),
    enabled: !!token,
  });

  const backupMutation = useMutation({
    mutationFn: () => adminApi.createBackup(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-info'] });
      toast.success(data.detail, { description: data.filename });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => adminApi.syncQueue(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(data.detail);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const latestBackup = backups?.[0];
  const totalBackupSize = backups?.reduce((sum, b) => sum + b.size_bytes, 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Database Administration</h1>

      {/* Storage overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Database Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemInfo ? formatBytes(systemInfo.db_size_bytes) : <Skeleton className="h-8 w-20 inline-block" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">movies.db</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vector Store</CardTitle>
            <FileBox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemInfo ? formatBytes(systemInfo.vector_store_size_bytes) : <Skeleton className="h-8 w-20 inline-block" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ChromaDB embeddings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Backups</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{backups?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalBackupSize > 0 ? `Total: ${formatBytes(totalBackupSize)}` : 'No backups'}
              {latestBackup && ` · Latest: ${timeAgo(latestBackup.created_at)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
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

      {/* Backup list */}
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
                    <TableHead>Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b, i) => (
                    <TableRow key={b.filename}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span title="Latest"><Clock className="h-3.5 w-3.5 text-emerald-400" /></span>}
                          {b.filename}
                        </div>
                      </TableCell>
                      <TableCell>{formatBytes(b.size_bytes)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(b.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {timeAgo(b.created_at)}
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
