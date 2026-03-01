import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { QueueList } from '../types';
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

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Queue Management</h1>
        <div className="flex gap-2">
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
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.tmdb_id}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.title ?? '—'}</TableCell>
                        <TableCell><StatusBadge status={item.status} /></TableCell>
                        <TableCell>{item.retries}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {item.message ?? '—'}
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
    </div>
  );
}
