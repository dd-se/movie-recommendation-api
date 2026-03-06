import { createContext } from 'react';

export interface ThemeState {
  themeId: string;
  setTheme: (id: string) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);
