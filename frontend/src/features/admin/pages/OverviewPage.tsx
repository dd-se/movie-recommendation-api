import { useQuery } from '@tanstack/react-query';
import { Users, Film, ListTodo, Database, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/api/admin';
import { useAdminToken } from '../hooks/useAdminToken';
import type { SystemStats, SchedulerJob } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function OverviewPage() {
  const { token } = useAdminToken();

  const { data: stats, isLoading } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(token),
    enabled: !!token,
  });

  const { data: jobs } = useQuery<SchedulerJob[]>({
    queryKey: ['admin', 'scheduler'],
    queryFn: () => adminApi.getScheduler(token),
    enabled: !!token,
  });

  const { data: health } = useQuery<{ status: string }>({
    queryKey: ['admin', 'health'],
    queryFn: () => adminApi.getHealth(),
  });

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        {health && (
          <StatusBadge
            status={health.status === 'ok' ? 'active' : 'failed'}
            label={health.status === 'ok' ? 'Healthy' : 'Unhealthy'}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Movies" value={stats?.total_movies ?? 0} />
        <StatCard icon={Users} label="Users" value={stats?.total_users ?? 0} sub={`${stats?.active_users ?? 0} active`} />
        <StatCard icon={ListTodo} label="Queue Items" value={stats?.total_queue ?? 0} />
        <StatCard icon={Database} label="Backups" value={stats?.total_backups ?? 0} />
      </div>

      {stats && Object.keys(stats.queue_by_status).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Queue by Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.queue_by_status).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {jobs && jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Background Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.job_id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{job.name}</p>
                    <p className="text-xs text-muted-foreground">{job.trigger}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {job.next_run_time
                      ? `Next: ${new Date(job.next_run_time).toLocaleString()}`
                      : 'Paused'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
