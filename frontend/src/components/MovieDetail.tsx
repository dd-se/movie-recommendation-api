import { X, Star, Clock, Calendar, TrendingUp, Users, Globe } from 'lucide-react';
import type { Movie } from '../types';
import { useState } from 'react';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

interface Props {
  movie: Movie;
  onClose: () => void;
}

export default function MovieDetail({ movie, onClose }: Props) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-surface-secondary rounded-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface/80 backdrop-blur-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col sm:flex-row">
          {/* Poster */}
          <div className="sm:w-64 shrink-0">
            {movie.poster_path && !imgError ? (
              <img
                src={`${TMDB_IMG}${movie.poster_path}`}
                alt={movie.title}
                className="w-full h-auto sm:h-full object-cover sm:rounded-l-2xl rounded-t-2xl sm:rounded-tr-none"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-48 sm:h-full bg-surface-tertiary flex items-center justify-center sm:rounded-l-2xl rounded-t-2xl sm:rounded-tr-none">
                <span className="text-text-muted text-4xl">🎬</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-1">{movie.title}</h2>

            {movie.genres && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {movie.genres.split(', ').map((g) => (
                  <span key={g} className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-accent/10 text-accent-hover">
                    {g}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              {movie.vote_average != null && (
                <Stat icon={<Star className="w-4 h-4 text-warning" />} label="Rating" value={`${movie.vote_average.toFixed(1)} / 10`} />
              )}
              {movie.runtime != null && (
                <Stat icon={<Clock className="w-4 h-4 text-accent-hover" />} label="Runtime" value={`${movie.runtime} min`} />
              )}
              {movie.release_date && (
                <Stat icon={<Calendar className="w-4 h-4 text-success" />} label="Released" value={movie.release_date} />
              )}
              {movie.popularity != null && (
                <Stat icon={<TrendingUp className="w-4 h-4 text-error" />} label="Popularity" value={movie.popularity.toFixed(1)} />
              )}
              {movie.vote_count != null && (
                <Stat icon={<Users className="w-4 h-4 text-text-muted" />} label="Votes" value={movie.vote_count.toLocaleString()} />
              )}
              {movie.status && (
                <Stat icon={<Globe className="w-4 h-4 text-text-muted" />} label="Status" value={movie.status} />
              )}
            </div>

            {movie.overview && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Overview</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{movie.overview}</p>
              </div>
            )}

            {movie.cast && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Cast</h4>
                <p className="text-sm text-text-secondary">{movie.cast}</p>
              </div>
            )}

            <a
              href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-tmdb-green/15 text-tmdb-green text-sm font-medium hover:bg-tmdb-green/25 transition-colors"
            >
              View on TMDB →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-tertiary/50">
      {icon}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-text-primary">{value}</p>
      </div>
    </div>
  );
}
