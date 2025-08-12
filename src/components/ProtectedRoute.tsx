import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'branch_manager';
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Check if user requires password reset
    if (user.user_metadata?.requires_password_reset) {
      navigate('/password-reset', { replace: true });
      return;
    }

    if (requiredRole && user.profile?.role !== requiredRole) {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [user, loading, navigate, requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (
    !user ||
    user.user_metadata?.requires_password_reset ||
    (requiredRole && user.profile?.role !== requiredRole)
  ) {
    return null;
  }

  return <>{children}</>;
}
