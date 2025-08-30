import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { UserRole } from '@/lib/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({
  children,
  requiredRole,
  allowedRoles,
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { user, loading, checkUserStatus } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Check user status on route change
    checkUserStatus();

    // Check if user requires password reset
    if (user.user_metadata?.requires_password_reset) {
      navigate('/password-reset', { replace: true });
      return;
    }

    // Check if user is active
    if (user.profile?.is_active === false) {
      navigate('/login', { replace: true });
      return;
    }

    // Check role permissions
    const hasPermission = () => {
      if (!user.profile?.role || user.profile?.is_active === false)
        return false;
      if (requiredRole) return user.profile.role === requiredRole;
      if (allowedRoles) return allowedRoles.includes(user.profile.role);
      return true; // No role restrictions
    };

    if (!hasPermission()) {
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [user, loading, navigate, requiredRole, allowedRoles]);

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

  // Check role permissions for render
  const hasPermission = () => {
    if (!user?.profile?.role || user?.profile?.is_active === false)
      return false;
    if (requiredRole) return user.profile.role === requiredRole;
    if (allowedRoles) return allowedRoles.includes(user.profile.role);
    return true; // No role restrictions
  };

  if (
    !user ||
    user.profile?.is_active === false ||
    user.user_metadata?.requires_password_reset ||
    !hasPermission()
  ) {
    return null;
  }

  return <>{children}</>;
}
