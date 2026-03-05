import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Database,
  ListTodo,
  ChevronLeft,
  Shield,
  LayoutDashboard,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { adminApi } from '@/api/admin';
import { useAdminToken } from '../hooks/useAdminToken';
import type { SystemStats } from '../types';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users, exact: false },
  { to: '/admin/database', label: 'Database', icon: Database, exact: false },
  { to: '/admin/queue', label: 'Queue', icon: ListTodo, exact: false, badgeKey: 'queue' as const },
  { to: '/admin/system', label: 'System', icon: Server, exact: false },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAdminToken();

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: health } = useQuery<{ status: string }>({
    queryKey: ['admin', 'health'],
    queryFn: () => adminApi.getHealth(),
    refetchInterval: 15_000,
  });

  const isActive = (to: string, exact: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  const failedCount = stats?.queue_by_status?.failed ?? 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-border/50 shrink-0">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to App
          </Button>
          <Separator orientation="vertical" className="mx-3 h-5" />
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Admin Panel</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${health.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs text-muted-foreground">
                {health.status === 'ok' ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border/50 p-3 overflow-y-auto hidden md:block">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact, badgeKey }) => {
              const badge = badgeKey === 'queue' && failedCount > 0 ? failedCount : null;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(to, exact)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {badge !== null && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400 text-xs font-medium px-1.5">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar stats */}
          {stats && (
            <div className="mt-6 pt-4 border-t border-border/50 space-y-2">
              <p className="text-xs text-muted-foreground font-medium px-3 mb-2">Quick Stats</p>
              <SidebarStat label="Movies" value={stats.total_movies} />
              <SidebarStat label="Users" value={stats.total_users} />
              <SidebarStat label="Queue" value={stats.total_queue} />
              <SidebarStat label="Backups" value={stats.total_backups} />
            </div>
          )}
        </aside>

        {/* Mobile nav (visible on small screens) */}
        <div className="flex md:hidden border-b border-border/50 w-full absolute top-14 z-10 bg-background px-2 py-1.5 overflow-x-auto gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact, badgeKey }) => {
            const badge = badgeKey === 'queue' && failedCount > 0 ? failedCount : null;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive(to, exact)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {badge !== null && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium px-1">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pt-16 md:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium font-mono">{value.toLocaleString()}</span>
    </div>
  );
}
