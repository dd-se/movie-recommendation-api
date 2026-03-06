import { useEffect, useRef, useState } from 'react';
import { Star, Clock, Calendar, TrendingUp, Users, X, ExternalLink } from 'lucide-react';
import type { Movie } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w780';

interface Props {
  movie: Movie;
  onClose: () => void;
  columns: number;
  selectedIndex: number;
}

export default function MovieExpandedDetail({ movie, onClose, columns, selectedIndex }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState(false);
  const [visible, setVisible] = useState(false);

  const arrowCol = (selectedIndex % columns);
  const arrowLeftPercent = ((arrowCol + 0.5) / columns) * 100;

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (visible && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [visible]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const rating = movie.vote_average?.toFixed(1);
  const year = movie.release_date?.split('-')[0];

  return (
    <div
      ref={panelRef}
      className="relative col-span-full"
      style={{ gridColumn: `1 / -1` }}
    >
      {/* Arrow pointer */}
      <div
        className="absolute -top-2 w-4 h-4 rotate-45 bg-card border-l border-t border-border/50 z-10"
        style={{ left: `${arrowLeftPercent}%`, transform: `translateX(-50%) rotate(45deg)` }}
      />

      <div
        className={`relative rounded-lg border border-border/50 bg-card overflow-hidden transition-all duration-500 ease-out ${
          visible ? 'opacity-100 max-h-[600px]' : 'opacity-0 max-h-0'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col md:flex-row">
          {/* Poster */}
          <div className="md:w-56 shrink-0">
            {movie.poster_path && !imgError ? (
              <img
                src={`${TMDB_IMG}${movie.poster_path}`}
                alt={movie.title}
                className="w-full h-full object-cover md:rounded-l-lg"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-48 md:h-full flex items-center justify-center bg-secondary text-muted-foreground text-5xl">
                🎬
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-5 md:p-6 min-w-0">
            <div className="pr-8">
              <h2 className="text-xl md:text-2xl font-bold leading-tight">{movie.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {rating && (
                  <span className="flex items-center gap-1 text-sm font-bold text-green-400">
                    <Star className="w-4 h-4 fill-green-400" /> {rating}
                  </span>
                )}
                {year && <span className="text-sm text-muted-foreground">{year}</span>}
                {movie.runtime && <span className="text-sm text-muted-foreground">{movie.runtime}m</span>}
                {movie.status && (
                  <Badge variant="outline" className="text-[11px] border-border/50 text-muted-foreground">
                    {movie.status}
                  </Badge>
                )}
              </div>
            </div>

            {movie.genres && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {movie.genres.split(', ').map((g) => (
                  <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                ))}
              </div>
            )}

            {movie.overview && (
              <p className="text-sm leading-relaxed text-muted-foreground mt-3 line-clamp-4">
                {movie.overview}
              </p>
            )}

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
              {movie.vote_average != null && (
                <span className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-yellow-500" />
                  {movie.vote_average.toFixed(1)}/10
                </span>
              )}
              {movie.runtime != null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                  {movie.runtime} min
                </span>
              )}
              {movie.vote_count != null && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-purple-400" />
                  {movie.vote_count.toLocaleString()} votes
                </span>
              )}
              {movie.popularity != null && (
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
                  {movie.popularity.toFixed(0)} popularity
                </span>
              )}
            </div>

            {movie.cast && (
              <p className="text-xs text-muted-foreground mt-3">
                <span className="text-foreground/70 font-medium">Cast:</span> {movie.cast}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-4">
              {movie.release_date && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Released {movie.release_date}
                </span>
              )}
              <Button variant="outline" size="sm" asChild className="gap-1.5 h-7 text-xs">
                <a href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  TMDB
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
