import { useState } from 'react';
import { User, Shield, Clock, Trash2, Loader2, Copy, Check, Key } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/api';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
    <div className="min-h-screen pb-12">
      {/* Hero */}
      <div className="relative h-[280px] flex items-end bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="relative px-8 pb-8 max-w-3xl mx-auto w-full flex items-end gap-5">
          <Avatar className="w-20 h-20 rounded-xl border-2 border-primary/30">
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-3xl font-bold">
              {user?.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{user?.email}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              {user?.access_token_scopes?.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 max-w-3xl mx-auto space-y-4 mt-2">
        {/* Account info */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" /> Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={<Shield className="w-4 h-4 text-primary" />} label="Permissions" value={user?.access_token_scopes?.join(', ') ?? 'None'} />
              <InfoItem icon={<Clock className="w-4 h-4 text-green-400" />} label="Token Expires" value={user?.access_token_expires ? new Date(user.access_token_expires).toLocaleDateString() : 'N/A'} />
            </div>
          </CardContent>
        </Card>

        {/* API Token */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" /> API Token
            </CardTitle>
            <CardDescription>Use this token to access the API directly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 rounded-md bg-secondary font-mono text-xs text-muted-foreground truncate border border-border/30">
                {token ? `${token.slice(0, 40)}...` : 'No token'}
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyToken} className="gap-2 shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && (
              <div className="p-3 rounded-md bg-primary/10 border border-primary/20 text-primary text-sm">
                {message}
              </div>
            )}

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                disabled={clearing}
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {clearing ? 'Clearing...' : 'Clear Recommendation History'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Erases all history so previously recommended movies can appear again.
              </p>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground">
              <a href="/docs" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View API Documentation →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
      {icon}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
