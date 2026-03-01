import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Users,
  Database,
  ListTodo,
  Activity,
  ChevronLeft,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: Activity, exact: true },
  { to: '/admin/users', label: 'Users', icon: Users, exact: false },
  { to: '/admin/database', label: 'Database', icon: Database, exact: false },
  { to: '/admin/queue', label: 'Queue', icon: ListTodo, exact: false },
  { to: '/admin/system', label: 'System', icon: Activity, exact: false },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string, exact: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex items-center h-14 px-4 border-b border-border/50 shrink-0">
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
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border/50 p-3 overflow-y-auto hidden md:block">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
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
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile nav (visible on small screens) */}
        <div className="flex md:hidden border-b border-border/50 w-full absolute top-14 z-10 bg-background px-2 py-1.5 overflow-x-auto gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
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
            </Link>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 pt-16 md:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
