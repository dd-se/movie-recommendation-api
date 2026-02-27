import { useState } from 'react';
import { User, Shield, Clock, Trash2, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api';
import { Navigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, token, isAuthenticated } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" />;

  const handleClearHistory = async () => {
    if (!token) return;
    setClearing(true);
    setMessage('');
    try {
      const res = await api.forgetRecommendations(token);
      setMessage(res.detail);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to clear history');
    } finally {
      setClearing(false);
    }
  };

  const handleCopyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
          <User className="w-8 h-8 text-accent-hover" />
          Profile
        </h1>
        <p className="text-text-muted mt-1">Manage your account and preferences</p>
      </div>

      {/* User Info */}
      <div className="bg-surface-secondary rounded-xl border border-border p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent-hover">
            {user?.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{user?.email}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-sm text-text-muted">
                {user?.access_token_scopes?.join(', ') || 'No scopes assigned'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoBlock
            icon={<Shield className="w-4 h-4 text-accent-hover" />}
            label="Permissions"
            value={user?.access_token_scopes?.join(', ') || 'None'}
          />
          <InfoBlock
            icon={<Clock className="w-4 h-4 text-success" />}
            label="Token Expires"
            value={user?.access_token_expires ? new Date(user.access_token_expires).toLocaleDateString() : 'N/A'}
          />
        </div>
      </div>

      {/* Token */}
      <div className="bg-surface-secondary rounded-xl border border-border p-6 mb-4">
        <h3 className="font-semibold text-text-primary mb-3">API Token</h3>
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2.5 rounded-lg bg-surface border border-border font-mono text-xs text-text-muted truncate">
            {token ? `${token.slice(0, 32)}...` : 'No token'}
          </div>
          <button
            onClick={handleCopyToken}
            className="px-4 py-2.5 rounded-lg bg-surface-tertiary text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2 text-sm"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-surface-secondary rounded-xl border border-border p-6">
        <h3 className="font-semibold text-text-primary mb-3">Actions</h3>

        {message && (
          <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent-hover text-sm mb-4">
            {message}
          </div>
        )}

        <button
          onClick={handleClearHistory}
          disabled={clearing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {clearing ? 'Clearing...' : 'Clear Recommendation History'}
        </button>
        <p className="text-xs text-text-muted mt-2">
          This will erase all your recommendation history, allowing previously recommended movies to appear again.
        </p>
      </div>
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary/50">
      {icon}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-text-primary">{value}</p>
      </div>
    </div>
  );
}
