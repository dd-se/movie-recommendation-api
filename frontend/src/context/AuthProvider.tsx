import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/api';
import type { User } from '@/types';
import { AuthContext } from './AuthContext';

const TOKEN_KEY = 'movie_api_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<User | null>(null);
  const fetchedRef = useRef(false);

  const saveToken = useCallback((t: string | null) => {
    setToken(t);
    fetchedRef.current = false;
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const u = await api.whoami(token);
      setUser(u);
    } catch {
      saveToken(null);
      setUser(null);
    }
  }, [token, saveToken]);

  useEffect(() => {
    if (token && !fetchedRef.current) {
      fetchedRef.current = true;
      api.whoami(token).then(setUser).catch(() => {
        saveToken(null);
        setUser(null);
      });
    }
  }, [token, saveToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      let accessToken: string;
      try {
        const res = await api.login(email, password, 'movie:read movie:write');
        accessToken = res.access_token;
      } catch {
        const res = await api.login(email, password, 'movie:read');
        accessToken = res.access_token;
      }
      saveToken(accessToken);
      const u = await api.whoami(accessToken);
      setUser(u);
    },
    [saveToken],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      await api.signup(email, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, [saveToken]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: !!token && !!user,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [token, user, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
