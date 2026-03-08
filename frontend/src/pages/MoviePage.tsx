import { useEffect, useState, useLayoutEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Star, Clock, TrendingUp, Users, ArrowLeft, ExternalLink, Play,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import type { Movie } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w780';
const TMDB_IMG_SM = 'https://image.tmdb.org/t/p/w500';

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  const passedMovie = (location.state as { movie?: Movie } | null)?.movie ?? null;
  const initialMovie = passedMovie && String(passedMovie.tmdb_id) === id ? passedMovie : null;

  const [movie, setMovie] = useState<Movie | null>(initialMovie);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(!initialMovie);
  const [imgError, setImgError] = useState(false);

  useLayoutEffect(() => {
    const el = document.getElementById('main-scroll');
    if (el) el.scrollTop = 0;
  }, [id]);

  useEffect(() => {
    if (initialMovie) return;
    if (!id) return;
    let cancelled = false;

    api.getMovies('/v1/movie', { genres: ['Action', 'Drama', 'Comedy', 'Thriller', 'Adventure', 'Science Fiction', 'Horror', 'Romance', 'Animation', 'Fantasy'] }, undefined)
      .then((movies) => {
        if (!cancelled) setMovie(movies.find((m) => String(m.tmdb_id) === id) ?? null);
      })
      .catch(() => { if (!cancelled) setMovie(null); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id, initialMovie]);

  useEffect(() => {
    if (!movie?.genres) return;
    const genres = movie.genres.split(', ').slice(0, 4);
    if (genres.length === 0) return;
    let cancelled = false;

    if (token) {
      api.getMovies('/v2/search', { genres, n_results: 7 }, token)
        .then((movies) => {
          if (cancelled) return;
          setSimilar(movies.filter((m) => m.tmdb_id !== movie.tmdb_id).slice(0, 7));
        })
        .catch(() => { if (!cancelled) setSimilar([]); });
    } else {
      api.getMovies('/v1/movie', { genres }, undefined)
        .then((movies) => {
          if (cancelled) return;
          setSimilar(movies.filter((m) => m.tmdb_id !== movie.tmdb_id).slice(0, 7));
        })
        .catch(() => { if (!cancelled) setSimilar([]); });
    }

    return () => { cancelled = true; };
  }, [movie, token]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-[520px] bg-secondary/30 animate-pulse" />
        <div className="max-w-5xl mx-auto px-8 -mt-24 relative z-10 space-y-4">
          <Skeleton className="h-12 w-96" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Movie not found</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const rating = movie.vote_average?.toFixed(1);
  const year = movie.release_date?.split('-')[0];

  return (
    <div className="min-h-screen pb-16">
      {/* Hero */}
      <div className="relative h-[520px] md:h-[560px]">
        {movie.poster_path && !imgError ? (
          <img
            src={`${TMDB_IMG}${movie.poster_path}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />

        <div className="absolute top-4 left-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 px-8 pb-10 max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold drop-shadow-lg leading-tight">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            {rating && (
              <span className="flex items-center gap-1.5 text-base font-bold text-green-400">
                <Star className="w-5 h-5 fill-green-400" /> {rating}
              </span>
            )}
            {year && <span className="text-sm text-white/70">{year}</span>}
            {movie.runtime && <span className="text-sm text-white/70">{movie.runtime} min</span>}
            {movie.status && (
              <Badge variant="outline" className="text-xs border-white/20 text-white/70">
                {movie.status}
              </Badge>
            )}
          </div>

          {movie.genres && (
            <div className="flex flex-wrap gap-2 mt-3">
              {movie.genres.split(', ').map((g) => (
                <Badge key={g} variant="secondary" className="text-xs bg-white/10 border-white/10 text-white/90">
                  {g}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="max-w-5xl mx-auto px-8 mt-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-8">
          <div className="space-y-5">
            {movie.overview && (
              <p className="text-base leading-relaxed text-muted-foreground">{movie.overview}</p>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              {movie.vote_average != null && (
                <StatItem icon={<Star className="h-4 w-4 text-yellow-500" />} label="Rating" value={`${movie.vote_average.toFixed(1)}/10`} />
              )}
              {movie.runtime != null && (
                <StatItem icon={<Clock className="h-4 w-4 text-blue-400" />} label="Runtime" value={`${movie.runtime} min`} />
              )}
              {movie.vote_count != null && (
                <StatItem icon={<Users className="h-4 w-4 text-purple-400" />} label="Votes" value={movie.vote_count.toLocaleString()} />
              )}
              {movie.popularity != null && (
                <StatItem icon={<TrendingUp className="h-4 w-4 text-orange-400" />} label="Popularity" value={movie.popularity.toFixed(0)} />
              )}
            </div>
          </div>

          <div className="space-y-4 text-sm">
            {movie.cast && <MetaRow label="Cast" value={movie.cast} />}
            {movie.genres && <MetaRow label="Genres" value={movie.genres} />}
            {movie.release_date && <MetaRow label="Released" value={movie.release_date} />}
            <div className="pt-2">
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on TMDB
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* More Like This */}
        {similar.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-xl font-bold mb-4">More Like This</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {similar.map((m) => (
                  <SimilarCard key={m.tmdb_id} movie={m} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-foreground font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground/80">{value}</span>
    </div>
  );
}

function SimilarCard({ movie }: { movie: Movie }) {
  const [imgErr, setImgErr] = useState(false);
  const year = movie.release_date?.split('-')[0];
  const rating = movie.vote_average?.toFixed(1);

  return (
    <Link to={`/movie/${movie.tmdb_id}`} state={{ movie }} className="group cursor-pointer block">
      <div className="aspect-[2/3] rounded-md overflow-hidden bg-card relative">
        {movie.poster_path && !imgErr ? (
          <img
            src={`${TMDB_IMG_SM}${movie.poster_path}`}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-secondary text-muted-foreground gap-2">
            <Play className="w-8 h-8" />
            <span className="text-xs text-center px-2 line-clamp-2">{movie.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />
        <div className="absolute bottom-0 left-0 right-0 p-2.5 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <p className="text-xs font-bold text-white line-clamp-1">{movie.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/70">
            {rating && (
              <span className="flex items-center gap-0.5 text-green-400 font-semibold">
                <Star className="w-2.5 h-2.5 fill-green-400" /> {rating}
              </span>
            )}
            {year && <span>{year}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
