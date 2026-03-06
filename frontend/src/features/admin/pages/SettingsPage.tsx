import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key, ExternalLink, CheckCircle2, XCircle, Shield,
  Eye, EyeOff, Loader2, Copy, Check, Palette,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { adminApi } from '@/api/admin';
import type { TmdbKeyStatus } from '../types';
import { useAdminToken } from '../hooks/useAdminToken';
import ThemePicker from '@/components/ThemePicker';

const STEPS = [
  {
    title: 'Create a TMDB account',
    description: 'Go to themoviedb.org and click "Join TMDB" in the top-right. Fill in your details and verify your email.',
    link: 'https://www.themoviedb.org/signup',
    linkLabel: 'Sign up at TMDB',
  },
  {
    title: 'Open API Settings',
    description: 'Once logged in, go to your account Settings, then click "API" in the left sidebar.',
    link: 'https://www.themoviedb.org/settings/api',
    linkLabel: 'Go to API Settings',
  },
  {
    title: 'Request an API key',
    description: 'If you don\'t have an API key yet, click "Request an API Key" and choose "Developer". Fill in the required application details (you can use "Personal project" as the use case).',
  },
  {
    title: 'Copy the API Read Access Token',
    description: 'After your key is approved, you\'ll see two values on the API page. Copy the "API Read Access Token (v4 auth)" — this is the long token starting with "eyJ...". Do NOT use the shorter "API Key (v3 auth)".',
    important: true,
  },
  {
    title: 'Paste it below',
    description: 'Paste the token into the field below and click "Save API Key". The app will validate it against the TMDB API before saving.',
  },
];

export default function SettingsPage() {
  const { token } = useAdminToken();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: keyStatus, isLoading } = useQuery<TmdbKeyStatus>({
    queryKey: ['admin', 'tmdb-key'],
    queryFn: () => adminApi.getTmdbKey(token),
    enabled: !!token,
  });

  const validateMutation = useMutation({
    mutationFn: () => adminApi.validateTmdbKey(token, apiKey),
    onSuccess: (data) => {
      if (data.is_valid) {
        toast.success('API key is valid!');
      } else {
        toast.error('API key is invalid. Make sure you\'re using the Read Access Token (v4 auth).');
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => adminApi.updateTmdbKey(token, apiKey),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tmdb-key'] });
      toast.success('TMDB API key saved and activated!', {
        description: `Key: ${data.masked_key}`,
      });
      setApiKey('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCopyMask = () => {
    if (keyStatus?.masked_key) {
      navigator.clipboard.writeText(keyStatus.masked_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isWorking = validateMutation.isPending || saveMutation.isPending;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme
          </CardTitle>
          <CardDescription>
            Customize the accent color across the entire application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker columns={4} />
        </CardContent>
      </Card>

      {/* Current key status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            TMDB API Key
          </CardTitle>
          <CardDescription>
            Required for fetching movie data from The Movie Database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : keyStatus ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">Current Key</span>
                    {keyStatus.is_placeholder ? (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <XCircle className="h-3.5 w-3.5" />
                        Placeholder — not functional
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Configured
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                      {keyStatus.masked_key}
                    </code>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopyMask}>
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                {keyStatus.is_placeholder && (
                  <div className="shrink-0">
                    <div className="h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-amber-400" />
                    </div>
                  </div>
                )}
              </div>

              {keyStatus.is_placeholder && (
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-sm text-amber-200/80">
                  The app is using a placeholder key. Background jobs will fail to fetch movie data from TMDB.
                  Follow the steps below to get a real API key.
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Walkthrough */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Get Your TMDB API Key</CardTitle>
          <CardDescription>
            Follow these steps to obtain a free API Read Access Token from The Movie Database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {STEPS.map((step, i) => (
              <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Timeline line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/50" />
                )}
                {/* Step number */}
                <div className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold ${
                  step.important
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  {i + 1}
                </div>
                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium mb-1">{step.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {step.linkLabel}
                    </a>
                  )}
                  {step.important && (
                    <div className="mt-2 p-2.5 rounded-md border border-amber-500/20 bg-amber-500/5 text-xs text-amber-200/80">
                      Use the <strong>API Read Access Token (v4 auth)</strong>, not the API Key (v3 auth).
                      The token is much longer and starts with &quot;eyJ&quot;.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Enter Your API Key
          </CardTitle>
          <CardDescription>
            Paste your TMDB API Read Access Token (v4 auth) below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tmdb-key">API Read Access Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="tmdb-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiJ9..."
                    className="pr-10 font-mono text-sm"
                    disabled={isWorking}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This is the long token from your TMDB API page, not the short API key.
              </p>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => validateMutation.mutate()}
                disabled={!apiKey.trim() || isWorking}
                className="gap-2"
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Test Key
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!apiKey.trim() || isWorking}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                Save API Key
              </Button>
            </div>

            {validateMutation.data && !saveMutation.isPending && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                validateMutation.data.is_valid
                  ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                  : 'border-red-500/20 bg-red-500/5 text-red-400'
              }`}>
                {validateMutation.data.is_valid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Key is valid! Click &quot;Save API Key&quot; to apply it.
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 shrink-0" />
                    Key is invalid. Make sure you copied the API Read Access Token (v4 auth), not the API Key.
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
