import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 poster-wall" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-background/90 to-background" />
      <div className="absolute inset-0 vignette" />
      <div className="absolute inset-0 film-grain" />
      <Card className="relative z-10 w-full max-w-sm border-border/50 bg-card/90 backdrop-blur-md shadow-2xl shadow-black/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-2">
            <img src="/tmdb/tmdb-logo-short.svg" alt="TMDB" className="h-7 mx-auto" />
          </div>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Start discovering great movies</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={2}
                maxLength={15}
                placeholder="2-15 characters"
                className="bg-background/50"
              />
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3">
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {loading ? 'Creating account...' : 'Get Started'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
