import { Star, Clock, TrendingUp, Calendar } from 'lucide-react';
import type { Movie } from '../types';
import { useState } from 'react';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';

interface Props {
  movie: Movie;
  onClick?: () => void;
}

export default function MovieCard({ movie, onClick }: Props) {
  const [imgError, setImgError] = useState(false);
  const year = movie.release_date?.split('-')[0];
  const rating = movie.vote_average?.toFixed(1);

  return (
    <div
      onClick={onClick}
      className="group bg-surface-secondary rounded-xl overflow-hidden border border-border hover:border-accent/40 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 cursor-pointer hover:-translate-y-1"
    >
      {/* Poster */}
      <div className="aspect-[2/3] bg-surface-tertiary relative overflow-hidden">
        {movie.poster_path && !imgError ? (
          <img
            src={`${TMDB_IMG}${movie.poster_path}`}
            alt={movie.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <Film className="w-12 h-12" />
          </div>
        )}
        {rating && (
          <div className="absolute top-3 right-3 bg-surface/80 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-warning fill-warning" />
            <span className="text-sm font-semibold text-text-primary">{rating}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-accent-hover transition-colors">
          {movie.title}
        </h3>

        <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
          {year && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {movie.runtime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {movie.runtime}m
            </span>
          )}
          {movie.popularity && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {movie.popularity.toFixed(0)}
            </span>
          )}
        </div>

        {movie.genres && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {movie.genres.split(', ').slice(0, 3).map((g) => (
              <span key={g} className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-accent/10 text-accent-hover">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Film(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}
