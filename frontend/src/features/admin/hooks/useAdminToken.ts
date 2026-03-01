import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

export function useAdminToken() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleError = useCallback(
    (error: unknown) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          logout();
          navigate('/login');
        }
      }
    },
    [logout, navigate],
  );

  return { token: token ?? '', handleError };
}
