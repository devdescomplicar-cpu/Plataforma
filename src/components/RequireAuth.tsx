import { Navigate, useLocation } from 'react-router-dom';

const AUTH_TOKEN_KEY = 'auth_token';

/**
 * Redireciona para /login se não houver token no localStorage.
 * Usado para proteger rotas que exigem autenticação.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
