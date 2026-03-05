import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, RefreshCw, Send,
  RotateCcw, Trash2, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

import { adminApi } from '@/api/admin';
import { QUEUE_STATUSES } from '../types';
import type { QueueList, SystemStats } from '../types';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAdminToken } from '../hooks/useAdminToken';

export default function QueuePage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [refreshForm, setRefreshForm] = useState({
    status: 'refresh_data',
    message: '',
    movieIds: '',
  });

  const { data, isLoading, refetch } = useQuery<QueueList>({
    queryKey: ['admin', 'queue', page, statusFilter],
    queryFn: () => adminApi.getQueue(token, page, 20, statusFilter || undefined),
    enabled: !!token,
    placeholderData: keepPreviousData,
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(token),
    enabled: !!token,
    refetchInterval: autoRefresh ? 10_000 : 60_000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => {
      const movieIds = refreshForm.movieIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n) => !isNaN(n));

      return adminApi.refreshQueue(token, {
        status: refreshForm.status,
        message: refreshForm.message || undefined,
        movie_ids: movieIds.length > 0 ? movieIds : undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success(data.detail);
      setRefreshOpen(false);
      setRefreshForm({ status: 'refresh_data', message: '', movieIds: '' });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => adminApi.retryFailed(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(data.detail);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const purgeMutation = useMutation({
    mutationFn: () => adminApi.purgeCompleted(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(data.detail);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;
  const failedCount = stats?.queue_by_status?.failed ?? 0;
  const completedCount = stats?.queue_by_status?.completed ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Queue Management</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <Switch
              id="auto-refresh-queue"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh-queue" className="text-xs text-muted-foreground">Live</Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setRefreshOpen(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Update Queue
          </Button>
        </div>
      </div>

      {/* Quick actions bar */}
      {(failedCount > 0 || completedCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {failedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setConfirmRetry(true)}
              disabled={retryMutation.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry {failedCount} Failed
            </Button>
          )}
          {completedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => setConfirmPurge(true)}
              disabled={purgeMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Purge {completedCount} Completed
            </Button>
          )}
        </div>
      )}

      {/* Queue status summary */}
      {stats && Object.keys(stats.queue_by_status).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.queue_by_status).map(([status, count]) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status === statusFilter ? '' : status); setPage(1); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                status === statusFilter
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 hover:border-border'
              }`}
            >
              <StatusBadge status={status} />
              <span className="text-sm font-medium">{count}</span>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle className="text-base">
              Queue Items {data && <span className="text-muted-foreground font-normal">({data.total})</span>}
            </CardTitle>
            <Select value={statusFilter || '_all'} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                {QUEUE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      <TableHead className="w-24">TMDB ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20">Retries</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.id} className={item.status === 'failed' ? 'bg-red-500/5' : ''}>
                        <TableCell className="font-mono text-xs">{item.tmdb_id}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.title ?? '—'}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                        <TableCell>
                          <span className={item.retries > 0 ? 'text-amber-400 font-medium' : ''}>
                            {item.retries}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {item.message ? (
                            <span className="flex items-center gap-1" title={item.message}>
                              {item.status === 'failed' && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
                              {item.message}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data?.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No queue items found
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

      {/* Update Queue Dialog */}
      <Dialog open={refreshOpen} onOpenChange={setRefreshOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Queue Items</DialogTitle>
            <DialogDescription>Set a new status for queue entries. Leave Movie IDs empty to update all.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Status</Label>
              <Select value={refreshForm.status} onValueChange={(v) => setRefreshForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUEUE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message (optional)</Label>
              <Input
                value={refreshForm.message}
                onChange={(e) => setRefreshForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Optional status message"
              />
            </div>
            <div className="space-y-2">
              <Label>Movie IDs (optional, comma-separated)</Label>
              <Textarea
                value={refreshForm.movieIds}
                onChange={(e) => setRefreshForm((f) => ({ ...f, movieIds: e.target.value }))}
                placeholder="e.g. 12345, 67890"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefreshOpen(false)}>Cancel</Button>
            <Button onClick={() => setConfirmRefresh(true)} disabled={refreshMutation.isPending}>
              {refreshMutation.isPending ? 'Updating…' : 'Update Queue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmRefresh}
        onOpenChange={setConfirmRefresh}
        title="Confirm Queue Update"
        description={`This will set ${refreshForm.movieIds ? 'selected' : 'ALL'} queue items to "${refreshForm.status.replace(/_/g, ' ')}". This action cannot be undone.`}
        confirmLabel="Update"
        destructive={!refreshForm.movieIds}
        onConfirm={() => {
          refreshMutation.mutate();
          setConfirmRefresh(false);
        }}
      />

      <ConfirmDialog
        open={confirmRetry}
        onOpenChange={setConfirmRetry}
        title="Retry Failed Items"
        description={`This will reset ${failedCount} failed queue items back to 'refresh_data' status for reprocessing.`}
        confirmLabel="Retry All"
        onConfirm={() => { retryMutation.mutate(); setConfirmRetry(false); }}
      />

      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Purge Completed Items"
        description={`This will permanently delete ${completedCount} completed queue entries. This action cannot be undone.`}
        confirmLabel="Purge"
        destructive
        onConfirm={() => { purgeMutation.mutate(); setConfirmPurge(false); }}
      />
    </div>
  );
}
