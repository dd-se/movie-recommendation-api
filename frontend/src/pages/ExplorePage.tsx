import { Film, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const GENRE_SUGGESTIONS = [
  { name: 'Action', emoji: '💥' },
  { name: 'Comedy', emoji: '😂' },
  { name: 'Drama', emoji: '🎭' },
  { name: 'Horror', emoji: '👻' },
  { name: 'Science Fiction', emoji: '🚀' },
  { name: 'Thriller', emoji: '🔪' },
  { name: 'Romance', emoji: '💕' },
  { name: 'Animation', emoji: '🎨' },
  { name: 'Documentary', emoji: '📽️' },
  { name: 'Adventure', emoji: '🗺️' },
  { name: 'Fantasy', emoji: '🧙' },
  { name: 'Mystery', emoji: '🔍' },
];

const SEARCH_IDEAS = [
  { query: 'A group of superheroes saving the world', description: 'Epic hero stories' },
  { query: 'A journey through space and time', description: 'Sci-fi adventures' },
  { query: 'A detective solving a complex murder mystery', description: 'Crime thrillers' },
  { query: 'Coming of age story about friendship', description: 'Heartfelt dramas' },
  { query: 'A heist with an unexpected twist', description: 'Clever capers' },
  { query: 'Surviving alone in a hostile environment', description: 'Survival stories' },
];

export default function ExplorePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
          <Film className="w-8 h-8 text-accent-hover" />
          Explore
        </h1>
        <p className="text-text-muted mt-1">Inspiration for your next movie night</p>
      </div>

      {/* Genre cards */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Browse by Genre</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {GENRE_SUGGESTIONS.map((g) => (
            <Link
              key={g.name}
              to={`/?genres=${encodeURIComponent(g.name)}`}
              className="group p-4 rounded-xl bg-surface-secondary border border-border hover:border-accent/40 transition-all text-center hover:-translate-y-0.5"
            >
              <span className="text-2xl block mb-2">{g.emoji}</span>
              <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                {g.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Search ideas */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Search Ideas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SEARCH_IDEAS.map((idea) => (
            <Link
              key={idea.query}
              to={`/?description=${encodeURIComponent(idea.query)}`}
              className="group flex items-center gap-4 p-4 rounded-xl bg-surface-secondary border border-border hover:border-accent/40 transition-all"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary group-hover:text-accent-hover transition-colors">
                  &ldquo;{idea.query}&rdquo;
                </p>
                <p className="text-xs text-text-muted mt-1">{idea.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-hover transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* API Features */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">API Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            title="Basic Recommendation"
            description="Get movie recommendations based on filters like genre, cast, and ratings. No authentication required."
            endpoint="POST /v1/movie"
            available
          />
          <FeatureCard
            title="Smart Recommendation"
            description="Never get the same movie recommended twice. Tracks your history for unique suggestions."
            endpoint="POST /v2/movie"
            available={isAuthenticated}
          />
          <FeatureCard
            title="Semantic Search"
            description="Describe any movie in natural language and find matches using AI-powered vector embeddings."
            endpoint="POST /v2/search"
            available={isAuthenticated}
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  title, description, endpoint, available,
}: {
  title: string; description: string; endpoint: string; available: boolean;
}) {
  return (
    <div className={`p-5 rounded-xl border transition-all ${available ? 'bg-surface-secondary border-border' : 'bg-surface-tertiary/30 border-border/50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold text-text-primary">{title}</h3>
        {!available && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">Auth Required</span>}
      </div>
      <p className="text-sm text-text-muted mb-3">{description}</p>
      <code className="text-xs px-2 py-1 rounded bg-surface text-accent-hover font-mono">{endpoint}</code>
    </div>
  );
}
