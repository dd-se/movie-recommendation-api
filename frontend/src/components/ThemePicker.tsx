import { Check } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface Props {
  columns?: number;
}

export default function ThemePicker({ columns = 4 }: Props) {
  const { themeId, setTheme } = useTheme();

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {THEMES.map((theme) => {
        const active = theme.id === themeId;
        return (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={cn(
              'group relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-all cursor-pointer',
              active
                ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30'
                : 'border-border/50 hover:border-border hover:bg-muted/30',
            )}
          >
            <div className="relative">
              <div
                className="h-8 w-8 rounded-full border-2 border-background shadow-md transition-transform group-hover:scale-110"
                style={{ backgroundColor: theme.preview }}
              />
              {active && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-4 w-4 text-white drop-shadow-md" />
                </div>
              )}
            </div>
            <span className={cn(
              'text-xs font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}>
              {theme.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
