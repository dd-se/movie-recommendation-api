import { useQuery } from '@tanstack/react-query';
import { Activity, Heart, Clock } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { adminApi } from '@/api/admin';
import type { SchedulerJob, SystemStats } from '../types';
import StatusBadge from '../components/StatusBadge';
import { useAdminToken } from '../hooks/useAdminToken';

export default function SystemPage() {
  const { token } = useAdminToken();

  const { data: health, isLoading: healthLoading } = useQuery<{ status: string }>({
    queryKey: ['admin', 'health'],
    queryFn: () => adminApi.getHealth(),
    refetchInterval: 30_000,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<SchedulerJob[]>({
    queryKey: ['admin', 'scheduler'],
    queryFn: () => adminApi.getScheduler(token),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(token),
    enabled: !!token,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">System Monitoring</h1>

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
            <Clock className="h-4 w-4" />
            Background Jobs
          </CardTitle>
          <CardDescription>APScheduler background tasks</CardDescription>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell className="font-mono text-xs">{job.job_id}</TableCell>
                      <TableCell className="font-medium">{job.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{job.trigger}</TableCell>
                      <TableCell className="text-xs">
                        {job.next_run_time
                          ? new Date(job.next_run_time).toLocaleString()
                          : <StatusBadge status="disabled" label="Paused" />}
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
    </div>
  );
}
