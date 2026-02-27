import { useCallback, useState } from 'react';
import { Search, SlidersHorizontal, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import type { Endpoint, Movie, MovieFilter } from '../types';
import MovieCard from '../components/MovieCard';
import MovieDetail from '../components/MovieDetail';

export default function DiscoverPage() {
  const { token, isAuthenticated } = useAuth();

  const [endpoint, setEndpoint] = useState<Endpoint>('/v1/movie');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cast, setCast] = useState('');
  const [genres, setGenres] = useState('');
  const [nResults, setNResults] = useState(6);

  // Advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [voteMin, setVoteMin] = useState('');
  const [voteCountMin, setVoteCountMin] = useState('');
  const [popularityMin, setPopularityMin] = useState('');
  const [releaseDateFrom, setReleaseDateFrom] = useState('');
  const [releaseDateTo, setReleaseDateTo] = useState('');
  const [runtimeMin, setRuntimeMin] = useState('');
  const [runtimeMax, setRuntimeMax] = useState('');
  const [keywords, setKeywords] = useState('');
  const [countries, setCountries] = useState('');
  const [languages, setLanguages] = useState('');

  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setSearched(true);

    const filter: MovieFilter = {};
    if (title) filter.title = title;
    if (description) filter.description = description;
    if (cast) filter.cast = splitCsv(cast);
    if (genres) filter.genres = splitCsv(genres);
    if (keywords) filter.keywords = splitCsv(keywords);
    if (countries) filter.production_countries = splitCsv(countries);
    if (languages) filter.spoken_languages = splitCsv(languages);
    if (voteMin) filter.vote_average_min = parseFloat(voteMin);
    if (voteCountMin) filter.vote_count_min = parseInt(voteCountMin);
    if (popularityMin) filter.popularity_min = parseFloat(popularityMin);
    if (releaseDateFrom) filter.release_date_from = releaseDateFrom;
    if (releaseDateTo) filter.release_date_to = releaseDateTo;
    if (runtimeMin) filter.runtime_min = parseInt(runtimeMin);
    if (runtimeMax) filter.runtime_max = parseInt(runtimeMax);
    if (endpoint === '/v2/search') filter.n_results = nResults;

    try {
      const needsAuth = endpoint.startsWith('/v2');
      const data = await api.getMovies(endpoint, filter, needsAuth ? token ?? undefined : undefined);
      setMovies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [title, description, cast, genres, keywords, countries, languages, voteMin, voteCountMin, popularityMin, releaseDateFrom, releaseDateTo, runtimeMin, runtimeMax, endpoint, nResults, token]);

  const v2Available = isAuthenticated;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-accent-hover" />
          Discover Movies
        </h1>
        <p className="text-text-muted mt-1">Find your next favorite movie with powerful filters and semantic search</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-surface-secondary rounded-xl border border-border p-5 mb-6">
        {/* Endpoint selector */}
        <div className="flex flex-wrap gap-2 mb-5">
          {([
            ['/v1/movie', 'Recommend', false],
            ['/v2/movie', 'Smart Recommend', true],
            ['/v2/search', 'Semantic Search', true],
          ] as [Endpoint, string, boolean][]).map(([ep, label, authRequired]) => (
            <button
              key={ep}
              type="button"
              onClick={() => setEndpoint(ep)}
              disabled={authRequired && !v2Available}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                endpoint === ep
                  ? 'bg-accent text-white'
                  : authRequired && !v2Available
                    ? 'bg-surface-tertiary/50 text-text-muted cursor-not-allowed'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              {label}
              {authRequired && !v2Available && (
                <span className="ml-1.5 text-[10px]">🔒</span>
              )}
            </button>
          ))}
        </div>

        {/* Main inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inception"
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Genres</label>
            <input
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              placeholder="Action, Thriller"
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Cast</label>
            <input
              value={cast}
              onChange={(e) => setCast(e.target.value)}
              placeholder="Brad Pitt, Edward Norton"
              className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          {endpoint === '/v2/search' ? (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Max Results</label>
              <input
                type="number"
                min={1}
                max={21}
                value={nResults}
                onChange={(e) => setNResults(parseInt(e.target.value) || 6)}
                className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
              />
            </div>
          ) : (
            <div />
          )}
        </div>

        {/* Description / semantic search */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-text-muted mb-1.5">Description (Semantic Search)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A computer hacker who discovers reality is a simulation..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all resize-none"
          />
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors mb-4"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Advanced Filters
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4 p-4 rounded-lg bg-surface/50 border border-border/50">
            <FilterInput label="Min Vote Avg" value={voteMin} onChange={setVoteMin} placeholder="6.5" type="number" step="0.1" min="0" max="10" />
            <FilterInput label="Min Vote Count" value={voteCountMin} onChange={setVoteCountMin} placeholder="100" type="number" min="0" />
            <FilterInput label="Min Popularity" value={popularityMin} onChange={setPopularityMin} placeholder="10" type="number" step="0.1" min="0" />
            <FilterInput label="Released After" value={releaseDateFrom} onChange={setReleaseDateFrom} placeholder="YYYY-MM-DD" />
            <FilterInput label="Released Before" value={releaseDateTo} onChange={setReleaseDateTo} placeholder="YYYY-MM-DD" />
            <FilterInput label="Min Runtime (min)" value={runtimeMin} onChange={setRuntimeMin} placeholder="90" type="number" min="0" />
            <FilterInput label="Max Runtime (min)" value={runtimeMax} onChange={setRuntimeMax} placeholder="180" type="number" min="0" />
            <FilterInput label="Keywords" value={keywords} onChange={setKeywords} placeholder="hacker, dystopia" />
            <FilterInput label="Countries" value={countries} onChange={setCountries} placeholder="United States" />
            <FilterInput label="Languages" value={languages} onChange={setLanguages} placeholder="English" />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-auto px-8 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search Movies
            </>
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {movies.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-text-muted">
              Found <span className="text-text-primary font-semibold">{movies.length}</span> movie{movies.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {movies.map((m) => (
              <MovieCard key={m.tmdb_id} movie={m} onClick={() => setSelectedMovie(m)} />
            ))}
          </div>
        </>
      ) : searched && !loading && !error ? (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No movies found</h3>
          <p className="text-sm text-text-muted">Try adjusting your search filters</p>
        </div>
      ) : !searched ? (
        <div className="text-center py-20">
          <Sparkles className="w-12 h-12 text-accent/40 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">Ready to discover</h3>
          <p className="text-sm text-text-muted">Use the search form above to find movie recommendations</p>
        </div>
      ) : null}

      {/* Detail modal */}
      {selectedMovie && (
        <MovieDetail movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}

function FilterInput({
  label, value, onChange, placeholder, type = 'text', ...rest
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  type?: string; [k: string]: unknown;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
        {...rest}
      />
    </div>
  );
}
