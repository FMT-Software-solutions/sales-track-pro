import React from 'react';
import { useAuth } from '@/hooks/useAuth';

interface RoleGuardProps {
  allowedRoles: ('admin' | 'branch_manager')[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
  const { profile } = useAuth();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for checking roles in components
export function useRoleCheck() {
  const { profile } = useAuth();

  const hasRole = (role: 'admin' | 'branch_manager') => {
    return profile?.role === role;
  };

  const hasAnyRole = (roles: ('admin' | 'branch_manager')[]) => {
    return profile ? roles.includes(profile.role) : false;
  };

  const isAdmin = () => profile?.role === 'admin';
  const isBranchManager = () => profile?.role === 'branch_manager';

  return {
    hasRole,
    hasAnyRole,
    isAdmin,
    isBranchManager,
    currentRole: profile?.role
  };
}