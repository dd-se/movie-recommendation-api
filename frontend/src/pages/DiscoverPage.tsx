import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Loader2, SlidersHorizontal } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import type { Endpoint, Movie, MovieFilter } from '@/types';
import MovieCard from '@/components/MovieCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { TmdbLogo, TmdbAttribution } from '@/components/TmdbBrand';
import { Separator } from '@/components/ui/separator';

export default function DiscoverPage() {
  const { token, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [endpoint, setEndpoint] = useState<Endpoint>('/v1/movie');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cast, setCast] = useState('');
  const [genres, setGenres] = useState('');
  const [nResults, setNResults] = useState(6);

  const [mobileOpen, setMobileOpen] = useState(false);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const splitCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const urlOverridesRef = useRef<{ title?: string; description?: string; genres?: string } | null>(null);
  const pendingSearchRef = useRef(false);
  const [restored, setRestored] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const savedMovies = sessionStorage.getItem('discover-movies');
    const savedFilters = sessionStorage.getItem('discover-filters');
    const wasSearched = sessionStorage.getItem('discover-searched');

    if (savedMovies || savedFilters) {
      if (savedMovies) {
        try {
          setMovies(JSON.parse(savedMovies));
        } catch { /* ignore parse errors */ }
      }
      if (savedFilters) {
        try {
          const f = JSON.parse(savedFilters);
          if (f.endpoint) setEndpoint(f.endpoint);
          if (f.title) setTitle(f.title);
          if (f.description) setDescription(f.description);
          if (f.cast) setCast(f.cast);
          if (f.genres) setGenres(f.genres);
          if (f.nResults) setNResults(f.nResults);
          if (f.keywords) setKeywords(f.keywords);
          if (f.countries) setCountries(f.countries);
          if (f.languages) setLanguages(f.languages);
          if (f.voteMin) setVoteMin(f.voteMin);
          if (f.voteCountMin) setVoteCountMin(f.voteCountMin);
          if (f.popularityMin) setPopularityMin(f.popularityMin);
          if (f.releaseDateFrom) setReleaseDateFrom(f.releaseDateFrom);
          if (f.releaseDateTo) setReleaseDateTo(f.releaseDateTo);
          if (f.runtimeMin) setRuntimeMin(f.runtimeMin);
          if (f.runtimeMax) setRuntimeMax(f.runtimeMax);
        } catch { /* ignore parse errors */ }
      }
      if (wasSearched === 'true') {
        setSearched(true);
      }
    }
    setRestored(true);
  }, []);

  // Save to sessionStorage when state changes
  useEffect(() => {
    if (!restored) return;
    if (searched && movies.length > 0) {
      sessionStorage.setItem('discover-movies', JSON.stringify(movies));
    }
  }, [movies, searched, restored]);

  useEffect(() => {
    if (!restored || !searched) return;
    sessionStorage.setItem('discover-filters', JSON.stringify({
      endpoint, title, description, cast, genres, nResults,
      keywords, countries, languages, voteMin, voteCountMin,
      popularityMin, releaseDateFrom, releaseDateTo, runtimeMin, runtimeMax
    }));
    sessionStorage.setItem('discover-searched', 'true');
  }, [endpoint, title, description, cast, genres, nResults, keywords, countries,
      languages, voteMin, voteCountMin, popularityMin, releaseDateFrom,
      releaseDateTo, runtimeMin, runtimeMax, searched, restored]);

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
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="relative h-[320px] flex-shrink-0 flex items-end overflow-hidden cinema-bg">
        <div className="absolute inset-0 cinema-overlay-hero" />
        <div className="relative px-8 pb-8 md:pl-[24rem] md:pr-8 max-w-6xl  w-full flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight drop-shadow-lg">Discover Movies</h1>
            <p className="text-lg text-muted-foreground drop-shadow-sm mt-2">
              Find your next favorite film with powerful filters and AI-powered semantic search.
            </p>
          </div>
          {/* Mobile filter button */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-[320px] sm:max-w-[360px] p-4 sm:p-6">
              <SidebarContent
                endpoint={endpoint}
                setEndpoint={setEndpoint}
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                cast={cast}
                setCast={setCast}
                genres={genres}
                setGenres={setGenres}
                nResults={nResults}
                setNResults={setNResults}
                voteMin={voteMin}
                setVoteMin={setVoteMin}
                voteCountMin={voteCountMin}
                setVoteCountMin={setVoteCountMin}
                popularityMin={popularityMin}
                setPopularityMin={setPopularityMin}
                releaseDateFrom={releaseDateFrom}
                setReleaseDateFrom={setReleaseDateFrom}
                releaseDateTo={releaseDateTo}
                setReleaseDateTo={setReleaseDateTo}
                runtimeMin={runtimeMin}
                setRuntimeMin={setRuntimeMin}
                runtimeMax={runtimeMax}
                setRuntimeMax={setRuntimeMax}
                keywords={keywords}
                setKeywords={setKeywords}
                countries={countries}
                setCountries={setCountries}
                languages={languages}
                setLanguages={setLanguages}
                loading={loading}
                error={error}
                isAuthenticated={isAuthenticated}
                onSearch={handleSearch}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar - Search Form */}
        <aside className="hidden glass-sidebar md:block fixed top-16 left-0 w-80 h-[calc(100vh-4rem)] p-4 overflow-y-auto z-40">
          <SidebarContent
            endpoint={endpoint}
            setEndpoint={setEndpoint}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            cast={cast}
            setCast={setCast}
            genres={genres}
            setGenres={setGenres}
            nResults={nResults}
            setNResults={setNResults}
            voteMin={voteMin}
            setVoteMin={setVoteMin}
            voteCountMin={voteCountMin}
            setVoteCountMin={setVoteCountMin}
            popularityMin={popularityMin}
            setPopularityMin={setPopularityMin}
            releaseDateFrom={releaseDateFrom}
            setReleaseDateFrom={setReleaseDateFrom}
            releaseDateTo={releaseDateTo}
            setReleaseDateTo={setReleaseDateTo}
            runtimeMin={runtimeMin}
            setRuntimeMin={setRuntimeMin}
            runtimeMax={runtimeMax}
            setRuntimeMax={setRuntimeMax}
            keywords={keywords}
            setKeywords={setKeywords}
            countries={countries}
            setCountries={setCountries}
            languages={languages}
            setLanguages={setLanguages}
            loading={loading}
            error={error}
            isAuthenticated={isAuthenticated}
            onSearch={handleSearch}
          />
        </aside>

        {/* Main Content - Results */}
        <main className="flex-1 p-4 md:ml-[23rem] min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
          {movies.length > 0 ? (
            <div className="max-w-5xl">
              <p className="text-sm text-muted-foreground mb-4">
                <span className="text-foreground font-semibold">{movies.length}</span> movie{movies.length !== 1 ? 's' : ''} found
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {movies.map((m) => (
                  <MovieCard key={m.tmdb_id} movie={m} />
                ))}
              </div>
            </div>
          ) : searched && !loading && !error ? (
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-semibold mb-1">No movies found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search filters</p>
            </div>
          ) : !searched ? (
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="text-5xl mb-4">🎬</div>
              <h3 className="text-lg font-semibold mb-1">Ready to discover</h3>
              <p className="text-sm text-muted-foreground text-center">Use the search filters to find your next favorite movie</p>
            </div>
          ) : null}
          </div>

          {/* TMDB attribution - footer at bottom of content column */}
          <footer className="border-t border-border/50 mt-auto pt-8 pb-8 max-w-5xl flex-shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex flex-col gap-3">
                <TmdbLogo variant="long" className="h-4 opacity-70 hover:opacity-100 transition-opacity" />
                <TmdbAttribution />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  TMDB
                </a>
                <Separator orientation="vertical" className="h-3" />
                <a href="https://developer.themoviedb.org/docs" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  TMDB API
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>
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
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-background/50 h-8 sm:h-9 text-xs sm:text-sm" />
    </div>
  );
}

interface SidebarContentProps {
  endpoint: Endpoint;
  setEndpoint: (v: Endpoint) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  cast: string;
  setCast: (v: string) => void;
  genres: string;
  setGenres: (v: string) => void;
  nResults: number;
  setNResults: (v: number) => void;
  voteMin: string;
  setVoteMin: (v: string) => void;
  voteCountMin: string;
  setVoteCountMin: (v: string) => void;
  popularityMin: string;
  setPopularityMin: (v: string) => void;
  releaseDateFrom: string;
  setReleaseDateFrom: (v: string) => void;
  releaseDateTo: string;
  setReleaseDateTo: (v: string) => void;
  runtimeMin: string;
  setRuntimeMin: (v: string) => void;
  runtimeMax: string;
  setRuntimeMax: (v: string) => void;
  keywords: string;
  setKeywords: (v: string) => void;
  countries: string;
  setCountries: (v: string) => void;
  languages: string;
  setLanguages: (v: string) => void;
  loading: boolean;
  error: string;
  isAuthenticated: boolean;
  onSearch: () => void;
}

const SidebarContent = memo(function SidebarContent({
  endpoint,
  setEndpoint,
  title,
  setTitle,
  description,
  setDescription,
  cast,
  setCast,
  genres,
  setGenres,
  nResults,
  setNResults,
  voteMin,
  setVoteMin,
  voteCountMin,
  setVoteCountMin,
  popularityMin,
  setPopularityMin,
  releaseDateFrom,
  setReleaseDateFrom,
  releaseDateTo,
  setReleaseDateTo,
  runtimeMin,
  setRuntimeMin,
  runtimeMax,
  setRuntimeMax,
  keywords,
  setKeywords,
  countries,
  setCountries,
  languages,
  setLanguages,
  loading,
  error,
  isAuthenticated,
  onSearch,
}: SidebarContentProps) {
  return (
    <form onSubmit={onSearch} className="space-y-4">
      <Tabs value={endpoint} onValueChange={(v) => setEndpoint(v as Endpoint)}>
        <TabsList className="w-full">
          <TabsTrigger value="/v1/movie" className="flex-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">Single</TabsTrigger>
          <TabsTrigger value="/v2/movie" disabled={!isAuthenticated} className="flex-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
            Smart {!isAuthenticated && '🔒'}
          </TabsTrigger>
          <TabsTrigger value="/v2/search" disabled={!isAuthenticated} className="flex-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
            Search {!isAuthenticated && '🔒'}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Accordion type="multiple" defaultValue={['basic', 'description']} className="w-full">
        <AccordionItem value="basic">
          <AccordionTrigger className="text-sm font-medium py-3">Basic Filters</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inception" className="bg-card h-9 sm:h-10 text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Genres</Label>
                <Input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Action, Thriller" className="bg-card h-9 sm:h-10 text-sm" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{endpoint === '/v2/search' ? 'Max Results' : 'Cast'}</Label>
                {endpoint === '/v2/search' ? (
                  <Input type="number" min={1} max={21} value={nResults} onChange={(e) => setNResults(parseInt(e.target.value) || 6)} className="bg-card h-9 sm:h-10 text-sm" />
                ) : (
                  <Input value={cast} onChange={(e) => setCast(e.target.value)} placeholder="Brad Pitt, Edward Norton" className="bg-card h-9 sm:h-10 text-sm" />
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="description">
          <AccordionTrigger className="text-sm font-medium py-3">Description</AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A computer hacker who discovers reality is a simulation..."
                rows={3}
                className="bg-card resize-none text-sm"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="advanced">
          <AccordionTrigger className="text-sm font-medium py-3">Advanced Filters</AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <div className="grid grid-cols-2 gap-2">
                <FilterInput label="Min Vote" value={voteMin} onChange={setVoteMin} placeholder="6.5" type="number" />
                <FilterInput label="Min Votes" value={voteCountMin} onChange={setVoteCountMin} placeholder="100" type="number" />
                <FilterInput label="Min Pop." value={popularityMin} onChange={setPopularityMin} placeholder="10" type="number" />
                <FilterInput label="After" value={releaseDateFrom} onChange={setReleaseDateFrom} placeholder="YYYY-MM-DD" />
                <FilterInput label="Before" value={releaseDateTo} onChange={setReleaseDateTo} placeholder="YYYY-MM-DD" />
                <FilterInput label="Min Min." value={runtimeMin} onChange={setRuntimeMin} placeholder="90" type="number" />
                <FilterInput label="Max Min." value={runtimeMax} onChange={setRuntimeMax} placeholder="180" type="number" />
                <FilterInput label="Keywords" value={keywords} onChange={setKeywords} placeholder="hacker" />
                <FilterInput label="Countries" value={countries} onChange={setCountries} placeholder="US" />
                <FilterInput label="Lang." value={languages} onChange={setLanguages} placeholder="English" />
                {endpoint === '/v2/search' && (
                  <FilterInput label="Cast" value={cast} onChange={setCast} placeholder="Brad Pitt" />
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button onClick={onSearch} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {loading ? 'Searching...' : 'Search Movies'}
      </Button>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
    </form>
  );
});
