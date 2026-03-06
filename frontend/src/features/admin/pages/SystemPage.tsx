import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Heart, Clock, Play, Pause, RotateCcw,
  Server, ScrollText, Terminal, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { adminApi } from '@/api/admin';
import type { SchedulerJob, SystemStats, SystemInfo, LogsResponse } from '../types';
import StatusBadge from '../components/StatusBadge';
import { useAdminToken } from '../hooks/useAdminToken';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function SystemPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logLines, setLogLines] = useState<string>('100');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);

  const { data: health, isLoading: healthLoading } = useQuery<{ status: string }>({
    queryKey: ['admin', 'health'],
    queryFn: () => adminApi.getHealth(),
    refetchInterval: 15_000,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<SchedulerJob[]>({
    queryKey: ['admin', 'scheduler'],
    queryFn: () => adminApi.getScheduler(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: systemInfo } = useQuery<SystemInfo>({
    queryKey: ['admin', 'system-info'],
    queryFn: () => adminApi.getSystemInfo(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<LogsResponse>({
    queryKey: ['admin', 'logs', logLines],
    queryFn: () => adminApi.getLogs(token, Number(logLines)),
    enabled: !!token,
    refetchInterval: autoRefreshLogs ? 5_000 : false,
  });

  const triggerMutation = useMutation({
    mutationFn: (jobId: string) => adminApi.triggerJob(token, jobId),
    onSuccess: (data) => {
      toast.success(data.detail);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: () => adminApi.pauseScheduler(token),
    onSuccess: (data) => {
      toast.success(data.detail);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-info'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resumeMutation = useMutation({
    mutationFn: () => adminApi.resumeScheduler(token),
    onSuccess: (data) => {
      toast.success(data.detail);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scheduler'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-info'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Monitoring</h1>

      {/* Health + System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Health Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">
                  API Server: {health?.status === 'ok' ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              System Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemInfo ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoItem label="Uptime" value={formatUptime(systemInfo.uptime_seconds)} />
                <InfoItem label="Python" value={systemInfo.python_version.split(' ')[0]} />
                <InfoItem label="Database" value={formatBytes(systemInfo.db_size_bytes)} />
                <InfoItem label="Vector Store" value={formatBytes(systemInfo.vector_store_size_bytes)} />
                <InfoItem label="Log File" value={formatBytes(systemInfo.log_file_size_bytes)} />
                <InfoItem label="Environment" value={systemInfo.environment} />
              </div>
            ) : (
              <Skeleton className="h-20 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduler */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Background Jobs
              </CardTitle>
              <CardDescription>APScheduler background tasks</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {systemInfo && (
                <StatusBadge
                  status={systemInfo.scheduler_running ? 'active' : 'disabled'}
                  label={systemInfo.scheduler_running ? 'Running' : 'Stopped'}
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                title="Pause scheduler"
              >
                <Pause className="h-3.5 w-3.5 mr-1" />
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                title="Resume scheduler"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Resume
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell className="font-mono text-xs">{job.job_id}</TableCell>
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{job.trigger}</TableCell>
                      <TableCell className="text-xs">
                        {job.next_run_time
                          ? new Date(job.next_run_time).toLocaleString()
                          : <StatusBadge status="disabled" label="Paused" />}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5"
                          onClick={() => triggerMutation.mutate(job.job_id)}
                          disabled={triggerMutation.isPending}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Run Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No scheduled jobs</p>
          )}
        </CardContent>
      </Card>

      {/* Queue status */}
      {stats && Object.keys(stats.queue_by_status).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Queue Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.queue_by_status).map(([status, count]) => (
                <div key={status} className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border/50">
                  <StatusBadge status={status} />
                  <span className="text-xl font-bold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log viewer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Application Logs
              </CardTitle>
              <CardDescription>
                {logs ? `${logs.total_lines} lines` : 'Recent log entries'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh-logs"
                  checked={autoRefreshLogs}
                  onCheckedChange={setAutoRefreshLogs}
                />
                <Label htmlFor="auto-refresh-logs" className="text-xs">Auto-refresh</Label>
              </div>
              <Select value={logLines} onValueChange={setLogLines}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 lines</SelectItem>
                  <SelectItem value="100">100 lines</SelectItem>
                  <SelectItem value="250">250 lines</SelectItem>
                  <SelectItem value="500">500 lines</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="relative">
              <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-500 font-mono">
                      {logs?.log_file ?? 'logs.txt'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-scroll"
                      checked={autoScroll}
                      onCheckedChange={setAutoScroll}
                    />
                    <Label htmlFor="auto-scroll" className="text-xs text-zinc-500">Auto-scroll</Label>
                  </div>
                </div>
                <div className="h-80 overflow-y-auto p-3 font-mono text-xs leading-5">
                  {logs && logs.lines.length > 0 ? (
                    logs.lines.map((line, i) => {
                      let color = 'text-zinc-400';
                      if (line.includes('| ERROR')) color = 'text-red-400';
                      else if (line.includes('| WARNING')) color = 'text-amber-400';
                      else if (line.includes('| INFO')) color = 'text-zinc-400';
                      else if (line.includes('| DEBUG')) color = 'text-zinc-600';
                      return (
                        <div key={i} className={`${color} hover:bg-zinc-900/50 px-1 -mx-1 rounded whitespace-pre-wrap break-all`}>
                          {line}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-zinc-600 text-center py-8">No log entries</div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium font-mono text-xs">{value}</span>
    </div>
  );
}
