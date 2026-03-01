import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasScope } from '@/lib/auth';

interface Props {
  scope: string;
  children: React.ReactNode;
  fallback?: string;
}

export default function RequireScope({ scope, children, fallback = '/' }: Props) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasScope(user, scope)) return <Navigate to={fallback} replace />;

  return <>{children}</>;
}
