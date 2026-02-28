import { Compass, ArrowRight, Sparkles, Shield, Zap, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TmdbLogo, TmdbAttribution } from '@/components/TmdbBrand';

const GENRES = [
  { name: 'Action', emoji: '💥', color: 'from-red-500/20 to-transparent' },
  { name: 'Comedy', emoji: '😂', color: 'from-yellow-500/20 to-transparent' },
  { name: 'Drama', emoji: '🎭', color: 'from-purple-500/20 to-transparent' },
  { name: 'Horror', emoji: '👻', color: 'from-green-500/20 to-transparent' },
  { name: 'Science Fiction', emoji: '🚀', color: 'from-blue-500/20 to-transparent' },
  { name: 'Thriller', emoji: '🔪', color: 'from-orange-500/20 to-transparent' },
  { name: 'Romance', emoji: '💕', color: 'from-pink-500/20 to-transparent' },
  { name: 'Animation', emoji: '🎨', color: 'from-cyan-500/20 to-transparent' },
  { name: 'Documentary', emoji: '📽️', color: 'from-amber-500/20 to-transparent' },
  { name: 'Adventure', emoji: '🗺️', color: 'from-emerald-500/20 to-transparent' },
  { name: 'Fantasy', emoji: '🧙', color: 'from-violet-500/20 to-transparent' },
  { name: 'Mystery', emoji: '🔍', color: 'from-indigo-500/20 to-transparent' },
];

const SEARCH_IDEAS = [
  { query: 'A group of superheroes saving the world', label: 'Epic hero stories' },
  { query: 'A journey through space and time', label: 'Sci-fi adventures' },
  { query: 'A detective solving a complex murder mystery', label: 'Crime thrillers' },
  { query: 'Coming of age story about friendship', label: 'Heartfelt dramas' },
  { query: 'A heist with an unexpected twist', label: 'Clever capers' },
  { query: 'Surviving alone in a hostile environment', label: 'Survival stories' },
];

export default function ExplorePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen pb-12">
      {/* Hero */}
      <div className="relative h-[320px] flex items-end overflow-hidden cinema-bg">
        <div className="absolute inset-0 cinema-overlay-hero" />
        <div className="relative px-8 pb-8 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3 mb-2">
            <Compass className="w-8 h-8 text-primary drop-shadow-lg" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-lg">Explore</h1>
          </div>
          <p className="text-lg text-muted-foreground drop-shadow-sm">Inspiration for your next movie night</p>
        </div>
      </div>

      <div className="px-8 max-w-6xl mx-auto space-y-12">
        {/* Genre grid */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Browse by Genre</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {GENRES.map((g) => (
              <Link
                key={g.name}
                to={`/?genres=${encodeURIComponent(g.name)}`}
                className={`group relative overflow-hidden rounded-lg p-4 text-center bg-gradient-to-b ${g.color} border border-border/30 hover:border-border transition-all hover:scale-[1.03] active:scale-[0.98]`}
              >
                <span className="text-3xl block mb-2">{g.emoji}</span>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {g.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Search ideas as horizontal scroll */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Try These Searches</h2>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {SEARCH_IDEAS.map((idea) => (
              <Link
                key={idea.query}
                to={`/?description=${encodeURIComponent(idea.query)}`}
                className="group flex-shrink-0 w-[320px] p-4 rounded-lg bg-card border border-border/30 hover:border-primary/40 transition-all"
              >
                <p className="text-sm font-medium text-foreground/90 group-hover:text-white transition-colors line-clamp-2 min-h-[40px]">
                  &ldquo;{idea.query}&rdquo;
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-muted-foreground">{idea.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* TMDB data source */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-[#01b4e4]" /> Data Source
          </h2>
          <Card className="border-border/30 bg-card overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6">
                <div className="shrink-0">
                  <TmdbLogo variant="long" className="h-6 opacity-90" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm text-muted-foreground mb-2">
                    All movie data — titles, overviews, posters, ratings, cast, and more — is sourced from
                    The Movie Database (TMDB), the community-built movie and TV database.
                  </p>
                  <TmdbAttribution />
                </div>
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-4 py-2 rounded-md text-sm font-medium bg-[#01b4e4]/10 text-[#01b4e4] hover:bg-[#01b4e4]/20 transition-colors"
                >
                  Visit TMDB →
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* API features */}
        <section>
          <h2 className="text-xl font-semibold mb-4">What You Can Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Zap className="w-5 h-5 text-yellow-500" />}
              title="Recommend"
              description="Get movie recommendations based on genre, cast, ratings and more."
              endpoint="POST /v1/movie"
              available
            />
            <FeatureCard
              icon={<Sparkles className="w-5 h-5 text-purple-400" />}
              title="Smart Recommend"
              description="Never get the same movie recommended twice. Tracks your viewing history."
              endpoint="POST /v2/movie"
              available={isAuthenticated}
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5 text-blue-400" />}
              title="Semantic Search"
              description="Describe any movie in natural language and find matches using AI."
              endpoint="POST /v2/search"
              available={isAuthenticated}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureCard({
  icon, title, description, endpoint, available,
}: {
  icon: React.ReactNode; title: string; description: string; endpoint: string; available: boolean;
}) {
  return (
    <Card className={`border-border/30 ${available ? 'bg-card' : 'bg-card/50 opacity-60'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
          {!available && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Auth</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="mb-3">{description}</CardDescription>
        <code className="text-xs px-2 py-1 rounded bg-secondary text-primary font-mono">{endpoint}</code>
      </CardContent>
    </Card>
  );
}
