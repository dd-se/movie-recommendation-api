import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Film, LogOut, Search, User, Clapperboard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLink = (to: string, label: string, icon: React.ReactNode) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
          active
            ? 'bg-accent/15 text-accent-hover'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-secondary border-r border-border flex flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-accent-hover" />
            </div>
            <div>
              <h1 className="text-base font-bold text-text-primary tracking-tight">MovieRec</h1>
              <p className="text-[11px] text-text-muted -mt-0.5">Discover & Recommend</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navLink('/', 'Discover', <Search className="w-4 h-4" />)}
          {navLink('/explore', 'Explore', <Film className="w-4 h-4" />)}
          {isAuthenticated &&
            navLink('/profile', 'Profile', <User className="w-4 h-4" />)}
        </nav>

        {isAuthenticated && user ? (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent-hover">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-text-primary">{user.email}</p>
                <p className="text-[11px] text-text-muted truncate">
                  {user.access_token_scopes?.join(', ') || 'No scopes'}
                </p>
              </div>
              <button onClick={handleLogout} title="Logout" className="text-text-muted hover:text-error transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-border">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
