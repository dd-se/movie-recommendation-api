import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext } from './ThemeContext';
import {
  applyTheme,
  getThemeById,
  loadSavedThemeId,
  saveThemeId,
} from '@/lib/themes';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(() => loadSavedThemeId());

  useEffect(() => {
    applyTheme(getThemeById(themeId));
  }, [themeId]);

  const setTheme = useCallback((id: string) => {
    setThemeIdState(id);
    saveThemeId(id);
  }, []);

  const value = useMemo(() => ({ themeId, setTheme }), [themeId, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
