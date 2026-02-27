import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import type { Endpoint, Movie, MovieFilter } from '@/types';
import MovieCard from '@/components/MovieCard';
import MovieDetail from '@/components/MovieDetail';
import { PoweredByTmdb } from '@/components/TmdbBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DiscoverPage() {
  const { token, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [endpoint, setEndpoint] = useState<Endpoint>('/v1/movie');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cast, setCast] = useState('');
  const [genres, setGenres] = useState('');
  const [nResults, setNResults] = useState(6);

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

  const urlOverridesRef = useRef<{ title?: string; description?: string; genres?: string } | null>(null);
  const pendingSearchRef = useRef(false);

  useEffect(() => {
    const qGenres = searchParams.get('genres');
    const qDescription = searchParams.get('description');
    const qTitle = searchParams.get('title');

    let hasParams = false;
    if (qGenres) { setGenres(qGenres); hasParams = true; }
    if (qDescription) { setDescription(qDescription); hasParams = true; }
    if (qTitle) { setTitle(qTitle); hasParams = true; }

    if (hasParams) {
      setSearchParams({}, { replace: true });
      urlOverridesRef.current = {
        title: qTitle ?? undefined,
        description: qDescription ?? undefined,
        genres: qGenres ?? undefined,
      };
      pendingSearchRef.current = true;
    }
  }, [searchParams, setSearchParams]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setSearched(true);

    const overrides = urlOverridesRef.current;
    urlOverridesRef.current = null;

    const curTitle = overrides?.title ?? title;
    const curDescription = overrides?.description ?? description;
    const curGenres = overrides?.genres ?? genres;

    const filter: MovieFilter = {};
    if (curTitle) filter.title = curTitle;
    if (curDescription) filter.description = curDescription;
    if (cast) filter.cast = splitCsv(cast);
    if (curGenres) filter.genres = splitCsv(curGenres);
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
      const message = err instanceof Error ? err.message : 'Search failed';
      if (message === 'Not found') {
        setMovies([]);
      } else {
        setError(message);
        setMovies([]);
      }
    } finally {
      setLoading(false);
    }
  }, [title, description, cast, genres, keywords, countries, languages, voteMin, voteCountMin, popularityMin, releaseDateFrom, releaseDateTo, runtimeMin, runtimeMax, endpoint, nResults, token]);

  useEffect(() => {
    if (pendingSearchRef.current) {
      pendingSearchRef.current = false;
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="min-h-screen">
      {/* Hero section */}
      <div className="relative h-[420px] flex items-end overflow-hidden">
        <div className="absolute inset-0 hero-cinematic" />
        <div className="absolute inset-0 film-grain" />
        <div className="relative px-8 pb-8 max-w-5xl w-full mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 drop-shadow-lg">
            Discover Movies
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-lg text-muted-foreground drop-shadow-sm">
              Find your next favorite film with powerful filters and AI-powered semantic search.
            </p>
            <PoweredByTmdb />
          </div>
        </div>
      </div>

      {/* Search section */}
      <div className="px-8 max-w-5xl mx-auto -mt-4">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Endpoint tabs */}
          <Tabs value={endpoint} onValueChange={(v) => setEndpoint(v as Endpoint)}>
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="/v1/movie">Recommend</TabsTrigger>
              <TabsTrigger value="/v2/movie" disabled={!isAuthenticated}>
                Smart Recommend {!isAuthenticated && '🔒'}
              </TabsTrigger>
              <TabsTrigger value="/v2/search" disabled={!isAuthenticated}>
                Semantic Search {!isAuthenticated && '🔒'}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Main filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inception" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Genres</Label>
              <Input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Action, Thriller" className="bg-card" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{endpoint === '/v2/search' ? 'Max Results' : 'Cast'}</Label>
              {endpoint === '/v2/search' ? (
                <Input type="number" min={1} max={21} value={nResults} onChange={(e) => setNResults(parseInt(e.target.value) || 6)} className="bg-card" />
              ) : (
                <Input value={cast} onChange={(e) => setCast(e.target.value)} placeholder="Brad Pitt, Edward Norton" className="bg-card" />
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description (Semantic Search)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A computer hacker who discovers reality is a simulation..."
              rows={2}
              className="bg-card resize-none"
            />
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Advanced Filters
            {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-card border border-border/50">
              <FilterInput label="Min Vote Avg" value={voteMin} onChange={setVoteMin} placeholder="6.5" type="number" />
              <FilterInput label="Min Vote Count" value={voteCountMin} onChange={setVoteCountMin} placeholder="100" type="number" />
              <FilterInput label="Min Popularity" value={popularityMin} onChange={setPopularityMin} placeholder="10" type="number" />
              <FilterInput label="Released After" value={releaseDateFrom} onChange={setReleaseDateFrom} placeholder="YYYY-MM-DD" />
              <FilterInput label="Released Before" value={releaseDateTo} onChange={setReleaseDateTo} placeholder="YYYY-MM-DD" />
              <FilterInput label="Min Runtime" value={runtimeMin} onChange={setRuntimeMin} placeholder="90" type="number" />
              <FilterInput label="Max Runtime" value={runtimeMax} onChange={setRuntimeMax} placeholder="180" type="number" />
              <FilterInput label="Keywords" value={keywords} onChange={setKeywords} placeholder="hacker, dystopia" />
              <FilterInput label="Countries" value={countries} onChange={setCountries} placeholder="United States" />
              <FilterInput label="Languages" value={languages} onChange={setLanguages} placeholder="English" />
              {endpoint === '/v2/search' && (
                <FilterInput label="Cast" value={cast} onChange={setCast} placeholder="Brad Pitt" />
              )}
            </div>
          )}

          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Searching...' : 'Search Movies'}
          </Button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="mt-8 pb-12">
          {movies.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                <span className="text-foreground font-semibold">{movies.length}</span> movie{movies.length !== 1 ? 's' : ''} found
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {movies.map((m) => (
                  <MovieCard key={m.tmdb_id} movie={m} onInfo={() => setSelectedMovie(m)} />
                ))}
              </div>
            </>
          ) : searched && !loading && !error ? (
            <div className="text-center py-20">
              <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">No movies found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search filters</p>
            </div>
          ) : !searched ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="text-lg font-semibold mb-1">Ready to discover</h3>
              <p className="text-sm text-muted-foreground">Use the search form above to find your next favorite movie</p>
            </div>
          ) : null}
        </div>
      </div>

      <MovieDetail movie={selectedMovie} open={!!selectedMovie} onClose={() => setSelectedMovie(null)} />
    </div>
  );
}

function FilterInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-background/50 h-8 text-xs" />
    </div>
  );
}
