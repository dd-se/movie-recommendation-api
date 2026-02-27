import { Star, Clock, Calendar, TrendingUp, Users, ExternalLink } from 'lucide-react';
import type { Movie } from '@/types';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w780';

interface Props {
  movie: Movie | null;
  open: boolean;
  onClose: () => void;
}

export default function MovieDetail({ movie, open, onClose }: Props) {
  const [imgError, setImgError] = useState(false);

  if (!movie) return null;

  const rating = movie.vote_average?.toFixed(1);
  const ratingPercent = movie.vote_average ? Math.round(movie.vote_average * 10) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-card border-border/50 gap-0">
        <DialogTitle className="sr-only">{movie.title}</DialogTitle>
        {/* Hero image */}
        <div className="relative aspect-video bg-secondary">
          {movie.poster_path && !imgError ? (
            <img
              src={`${TMDB_IMG}${movie.poster_path}`}
              alt={movie.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-6xl">
              🎬
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{movie.title}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {rating && (
                <span className="flex items-center gap-1 text-sm font-bold text-green-400">
                  <Star className="w-4 h-4 fill-green-400" /> {rating}
                </span>
              )}
              {ratingPercent > 0 && (
                <span className="text-sm font-semibold text-green-400">{ratingPercent}% Match</span>
              )}
              {movie.release_date && (
                <span className="text-sm text-white/60">{movie.release_date.split('-')[0]}</span>
              )}
              {movie.runtime && (
                <span className="text-sm text-white/60">{movie.runtime}m</span>
              )}
              {movie.status && (
                <Badge variant="outline" className="text-xs border-white/20 text-white/60">
                  {movie.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Genres */}
          {movie.genres && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.split(', ').map((g) => (
                <Badge key={g} variant="secondary" className="text-xs">
                  {g}
                </Badge>
              ))}
            </div>
          )}

          {/* Overview */}
          {movie.overview && (
            <p className="text-sm leading-relaxed text-muted-foreground">{movie.overview}</p>
          )}

          <Separator />

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {movie.vote_average != null && (
              <StatCard icon={<Star className="w-4 h-4 text-yellow-500" />} label="Rating" value={`${movie.vote_average.toFixed(1)}/10`} />
            )}
            {movie.runtime != null && (
              <StatCard icon={<Clock className="w-4 h-4 text-blue-400" />} label="Runtime" value={`${movie.runtime} min`} />
            )}
            {movie.vote_count != null && (
              <StatCard icon={<Users className="w-4 h-4 text-purple-400" />} label="Votes" value={movie.vote_count.toLocaleString()} />
            )}
            {movie.popularity != null && (
              <StatCard icon={<TrendingUp className="w-4 h-4 text-orange-400" />} label="Popularity" value={movie.popularity.toFixed(0)} />
            )}
          </div>

          {/* Cast */}
          {movie.cast && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Cast</p>
              <p className="text-sm text-foreground/80">{movie.cast}</p>
            </div>
          )}

          {/* Release */}
          {movie.release_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Released {movie.release_date}
            </div>
          )}

          {/* TMDB link */}
          <Button variant="outline" size="sm" asChild className="gap-2">
            <a href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" />
              View on TMDB
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-2.5 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
