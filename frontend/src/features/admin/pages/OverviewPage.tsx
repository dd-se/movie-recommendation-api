import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Film, ListTodo, Database, Play,
  RotateCcw, Trash2, RefreshCw, Zap, Timer, Server,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/api/admin';
import { useAdminToken } from '../hooks/useAdminToken';
import type { SystemStats, SchedulerJob, SystemInfo } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useState } from 'react';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OverviewPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const { data: stats, isLoading } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: jobs } = useQuery<SchedulerJob[]>({
    queryKey: ['admin', 'scheduler'],
    queryFn: () => adminApi.getScheduler(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: systemInfo } = useQuery<SystemInfo>({
    queryKey: ['admin', 'system-info'],
    queryFn: () => adminApi.getSystemInfo(token),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: health } = useQuery<{ status: string }>({
    queryKey: ['admin', 'health'],
    queryFn: () => adminApi.getHealth(),
    refetchInterval: 15_000,
  });

  const triggerMutation = useMutation({
    mutationFn: (jobId: string) => adminApi.triggerJob(token, jobId),
    onSuccess: (data) => {
      toast.success(data.detail);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: () => adminApi.retryFailed(token),
    onSuccess: (data) => {
      toast.success(data.detail);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const purgeMutation = useMutation({
    mutationFn: () => adminApi.purgeCompleted(token),
    onSuccess: (data) => {
      toast.success(data.detail);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const backupMutation = useMutation({
    mutationFn: () => adminApi.createBackup(token),
    onSuccess: (data) => {
      toast.success(data.detail, { description: data.filename });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const failedCount = stats?.queue_by_status?.failed ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {systemInfo && `Up ${formatUptime(systemInfo.uptime_seconds)}`}
            {systemInfo && ` · ${systemInfo.environment}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${health.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {health.status === 'ok' ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Movies" value={stats?.total_movies ?? 0}
          sub={systemInfo ? `DB: ${formatBytes(systemInfo.db_size_bytes)}` : undefined} />
        <StatCard icon={Users} label="Users" value={stats?.total_users ?? 0}
          sub={`${stats?.active_users ?? 0} active · ${stats?.disabled_users ?? 0} disabled`} />
        <StatCard icon={ListTodo} label="Queue" value={stats?.total_queue ?? 0}
          sub={failedCount > 0 ? `${failedCount} failed` : 'No failures'}
          alert={failedCount > 0} />
        <StatCard icon={Database} label="Backups" value={stats?.total_backups ?? 0}
          sub={systemInfo ? `Vector: ${formatBytes(systemInfo.vector_store_size_bytes)}` : undefined} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Actions
          </CardTitle>
          <CardDescription>Common administrative operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
            >
              <Database className="h-4 w-4 text-blue-400" />
              <div className="text-left">
                <div className="text-sm font-medium">{backupMutation.isPending ? 'Creating…' : 'Create Backup'}</div>
                <div className="text-xs text-muted-foreground">Snapshot the database</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => failedCount > 0 ? setConfirmRetry(true) : toast.info('No failed items to retry')}
              disabled={retryMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 text-amber-400" />
              <div className="text-left">
                <div className="text-sm font-medium">{retryMutation.isPending ? 'Retrying…' : 'Retry Failed'}</div>
                <div className="text-xs text-muted-foreground">{failedCount} failed items</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => setConfirmPurge(true)}
              disabled={purgeMutation.isPending}
            >
              <Trash2 className="h-4 w-4 text-red-400" />
              <div className="text-left">
                <div className="text-sm font-medium">{purgeMutation.isPending ? 'Purging…' : 'Purge Completed'}</div>
                <div className="text-xs text-muted-foreground">Clean up queue</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['admin'] });
                toast.success('Dashboard refreshed');
              }}
            >
              <RefreshCw className="h-4 w-4 text-emerald-400" />
              <div className="text-left">
                <div className="text-sm font-medium">Refresh All</div>
                <div className="text-xs text-muted-foreground">Reload all data</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Queue by status */}
      {stats && Object.keys(stats.queue_by_status).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Queue by Status</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.queue_by_status).map(([status, count]) => (
                <div key={status} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50">
                  <StatusBadge status={status} />
                  <span className="text-xl font-bold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Background jobs */}
      {jobs && jobs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Background Jobs
              </CardTitle>
              {systemInfo && (
                <StatusBadge
                  status={systemInfo.scheduler_running ? 'active' : 'disabled'}
                  label={systemInfo.scheduler_running ? 'Running' : 'Stopped'}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.job_id} className="flex items-center justify-between text-sm border-b border-border/30 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{job.name}</p>
                    <p className="text-xs text-muted-foreground">{job.trigger}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {job.next_run_time
                        ? `Next: ${new Date(job.next_run_time).toLocaleString()}`
                        : 'Paused'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => triggerMutation.mutate(job.job_id)}
                      disabled={triggerMutation.isPending}
                      title="Run now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System info */}
      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Python" value={systemInfo.python_version.split(' ')[0]} />
              <InfoItem label="Database Size" value={formatBytes(systemInfo.db_size_bytes)} />
              <InfoItem label="Vector Store" value={formatBytes(systemInfo.vector_store_size_bytes)} />
              <InfoItem label="Log File" value={formatBytes(systemInfo.log_file_size_bytes)} />
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmRetry}
        onOpenChange={setConfirmRetry}
        title="Retry Failed Items"
        description={`This will reset ${failedCount} failed queue items back to 'refresh_data' status so they can be reprocessed.`}
        confirmLabel="Retry All"
        onConfirm={() => { retryMutation.mutate(); setConfirmRetry(false); }}
      />

      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Purge Completed Items"
        description="This will permanently delete all completed queue entries. This action cannot be undone."
        confirmLabel="Purge"
        destructive
        onConfirm={() => { purgeMutation.mutate(); setConfirmPurge(false); }}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-amber-500/30' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-amber-400' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {sub && <p className={`text-xs mt-1 ${alert ? 'text-amber-400' : 'text-muted-foreground'}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium font-mono text-xs">{value}</span>
    </div>
  );
}
