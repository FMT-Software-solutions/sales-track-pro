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
      console.log('No user found, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (requiredRole && user.profile?.role !== requiredRole) {
      console.log('User lacks required role, redirecting to dashboard');
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

  if (!user || (requiredRole && user.profile?.role !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
