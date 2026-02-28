interface TmdbLogoProps {
  variant?: 'short' | 'long';
  className?: string;
}

export function TmdbLogo({ variant = 'short', className = '' }: TmdbLogoProps) {
  const src = variant === 'long' ? '/tmdb/tmdb-logo-long.svg' : '/tmdb/tmdb-logo-short.svg';
  return (
    <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className={`inline-block ${className}`}>
      <img src={src} alt="The Movie Database (TMDB)" className="h-full w-auto" />
    </a>
  );
}

export function TmdbAttribution({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      This product uses the{' '}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#01b4e4] hover:underline"
      >
        TMDB API
      </a>{' '}
      but is not endorsed or certified by TMDB.
    </p>
  );
}

export function PoweredByTmdb({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">Powered by</span>
      <TmdbLogo variant="short" className="h-3 opacity-60 hover:opacity-100 transition-opacity" />
    </div>
  );
}
