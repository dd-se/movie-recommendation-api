import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogOut, User, Compass, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TmdbLogo, TmdbAttribution } from '@/components/TmdbBrand';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.getElementById('main-scroll');
    if (!el) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setScrolled(el.scrollTop > 10);
        rafId = 0;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Netflix-style top nav */}
      <header
        className="glass-nav fixed top-0 left-0 right-0 z-50"
        data-scrolled={scrolled}
      >
        <div className="relative z-10 flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <TmdbLogo variant="short" className="h-4" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" active={isActive('/')} icon={<Search className="w-4 h-4" />}>
                Discover
              </NavLink>
              <NavLink to="/explore" active={isActive('/explore')} icon={<Compass className="w-4 h-4" />}>
                Explore
              </NavLink>
              {isAuthenticated && (
                <NavLink to="/profile" active={isActive('/profile')} icon={<User className="w-4 h-4" />}>
                  My Account
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-md p-0">
                    <Avatar className="h-8 w-8 rounded-md">
                      <AvatarFallback className="rounded-md bg-primary/20 text-primary text-sm font-bold">
                        {user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.access_token_scopes?.join(', ') ?? 'No scopes'}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  {isAdmin(user) && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="mr-2 h-4 w-4" /> Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="text-muted-foreground hover:text-foreground">
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate('/signup')} className="bg-primary hover:bg-primary/90">
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="main-scroll" className="flex-1 overflow-y-auto pt-16">
        <Outlet />

        {/* Footer with TMDB attribution */}
        <footer className="border-t border-border/50 mt-12">
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <TmdbLogo variant="long" className="h-4 opacity-70 hover:opacity-100 transition-opacity" />
                </div>
                <TmdbAttribution />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <a href="/docs" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  API Docs
                </a>
                <Separator orientation="vertical" className="h-3" />
                <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  TMDB
                </a>
                <Separator orientation="vertical" className="h-3" />
                <a href="https://developer.themoviedb.org/docs" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  TMDB API
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function NavLink({
  to, active, icon, children,
}: {
  to: string; active: boolean; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'text-foreground bg-white/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
