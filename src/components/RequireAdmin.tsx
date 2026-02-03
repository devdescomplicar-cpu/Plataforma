import { Navigate, useLocation } from 'react-router-dom';
import { useUser, isAdmin } from '@/hooks/useUser';

/**
 * Protects admin routes: requires auth and role === 'admin'.
 * Renders children only if user is admin; otherwise redirects to / (or /login if not authenticated).
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: userData, isError, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError || !userData?.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin(userData.user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
