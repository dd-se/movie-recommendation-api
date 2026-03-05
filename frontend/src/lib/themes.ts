export interface ThemeDefinition {
  id: string;
  name: string;
  preview: string;
  vars: Record<string, string>;
}

const BASE_NEUTRALS = {
  '--background': 'oklch(0.07 0 0)',
  '--foreground': 'oklch(0.95 0 0)',
  '--card': 'oklch(0.12 0 0)',
  '--card-foreground': 'oklch(0.95 0 0)',
  '--popover': 'oklch(0.12 0 0)',
  '--popover-foreground': 'oklch(0.95 0 0)',
  '--primary-foreground': 'oklch(1 0 0)',
  '--secondary': 'oklch(0.17 0 0)',
  '--secondary-foreground': 'oklch(0.90 0 0)',
  '--muted': 'oklch(0.17 0 0)',
  '--muted-foreground': 'oklch(0.55 0 0)',
  '--accent': 'oklch(0.17 0 0)',
  '--accent-foreground': 'oklch(0.90 0 0)',
  '--border': 'oklch(1 0 0 / 8%)',
  '--input': 'oklch(1 0 0 / 10%)',
  '--sidebar': 'oklch(0.10 0 0)',
  '--sidebar-foreground': 'oklch(0.95 0 0)',
  '--sidebar-primary-foreground': 'oklch(1 0 0)',
  '--sidebar-accent': 'oklch(0.17 0 0)',
  '--sidebar-accent-foreground': 'oklch(0.90 0 0)',
  '--sidebar-border': 'oklch(1 0 0 / 8%)',
};

function makeTheme(
  id: string,
  name: string,
  preview: string,
  accent: string,
  destructive: string,
): ThemeDefinition {
  return {
    id,
    name,
    preview,
    vars: {
      ...BASE_NEUTRALS,
      '--primary': accent,
      '--ring': accent,
      '--chart-1': accent,
      '--sidebar-primary': accent,
      '--sidebar-ring': accent,
      '--destructive': destructive,
    },
  };
}

const DESTRUCTIVE_RED = 'oklch(0.577 0.245 27.325)';

export const THEMES: ThemeDefinition[] = [
  makeTheme(
    'default',
    'Cinema Red',
    '#e11d48',
    'oklch(0.577 0.245 27.325)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'ocean',
    'Ocean Blue',
    '#3b82f6',
    'oklch(0.623 0.214 259.815)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'emerald',
    'Emerald',
    '#10b981',
    'oklch(0.696 0.17 162.48)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'purple',
    'Royal Purple',
    '#8b5cf6',
    'oklch(0.627 0.265 303.9)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'amber',
    'Amber Gold',
    '#f59e0b',
    'oklch(0.769 0.188 70.08)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'rose',
    'Rose Pink',
    '#f43f5e',
    'oklch(0.645 0.246 16.439)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'teal',
    'Teal',
    '#14b8a6',
    'oklch(0.704 0.14 182.503)',
    DESTRUCTIVE_RED,
  ),
  makeTheme(
    'sky',
    'Sky',
    '#0ea5e9',
    'oklch(0.685 0.169 237.323)',
    DESTRUCTIVE_RED,
  ),
];

export const DEFAULT_THEME_ID = 'default';

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}

const STORAGE_KEY = 'movie_app_theme';

export function loadSavedThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveThemeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage full or unavailable
  }
}
