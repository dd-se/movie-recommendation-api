import { Star, Play, Info } from 'lucide-react';
import type { Movie } from '@/types';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

interface Props {
  movie: Movie;
  onInfo: () => void;
  variant?: 'poster' | 'backdrop';
}

export default function MovieCard({ movie, onInfo, variant = 'poster' }: Props) {
  const [imgError, setImgError] = useState(false);
  const year = movie.release_date?.split('-')[0];
  const rating = movie.vote_average?.toFixed(1);

  if (variant === 'backdrop') {
    return (
      <div
        className="group relative flex-shrink-0 w-[300px] cursor-pointer"
        onClick={onInfo}
      >
        <div className="aspect-video rounded-md overflow-hidden bg-card">
          {movie.poster_path && !imgError ? (
            <img
              src={`${TMDB_IMG}${movie.poster_path}`}
              alt={movie.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary text-muted-foreground">
              <Play className="w-8 h-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <p className="text-sm font-semibold text-white line-clamp-1">{movie.title}</p>
            <div className="flex items-center gap-2 mt-1">
              {rating && (
                <span className="flex items-center gap-1 text-xs text-green-400 font-semibold">
                  <Star className="w-3 h-3 fill-green-400" /> {rating}
                </span>
              )}
              {year && <span className="text-xs text-white/60">{year}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative cursor-pointer" onClick={onInfo}>
      <div className="aspect-[2/3] rounded-md overflow-hidden bg-card relative">
        {movie.poster_path && !imgError ? (
          <img
            src={`${TMDB_IMG}${movie.poster_path}`}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-secondary text-muted-foreground gap-2">
            <Play className="w-10 h-10" />
            <span className="text-xs text-center px-2 line-clamp-2">{movie.title}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300" />

        {/* Rating badge */}
        {rating && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Badge variant="secondary" className="bg-black/70 backdrop-blur-sm text-green-400 border-0 gap-1 font-semibold">
              <Star className="w-3 h-3 fill-green-400" /> {rating}
            </Badge>
          </div>
        )}

        {/* Hover content */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <h3 className="text-sm font-bold text-white line-clamp-1">{movie.title}</h3>

          <div className="flex items-center gap-2 mt-1 text-[11px] text-white/70">
            {year && <span>{year}</span>}
            {movie.runtime && <span>• {movie.runtime}m</span>}
          </div>

          {movie.genres && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {movie.genres.split(', ').slice(0, 2).map((g) => (
                <span key={g} className="text-[10px] text-white/50">{g}</span>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 mt-2">
            <Button size="sm" className="h-7 text-xs gap-1 bg-white text-black hover:bg-white/90 flex-1">
              <Info className="w-3 h-3" /> Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
