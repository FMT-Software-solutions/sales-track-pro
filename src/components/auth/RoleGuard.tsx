import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/lib/auth';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { profile } = useAuth();

  if (!profile || profile.is_active === false || !allowedRoles.includes(profile.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook for checking roles in components
export function useRoleCheck() {
  const { profile } = useAuth();

  const hasRole = (role: UserRole) => {
    return profile?.role === role && profile?.is_active !== false;
  };

  const hasAnyRole = (roles: UserRole[]) => {
    return profile && profile.is_active !== false ? roles.includes(profile.role) : false;
  };

  // Role hierarchy helpers
  const isOwner = () => profile?.role === 'owner';
  const isAdmin = () => profile?.role === 'admin';
  const isBranchManager = () => profile?.role === 'branch_manager';
  const isAuditor = () => profile?.role === 'auditor';
  const isSalesPerson = () => profile?.role === 'sales_person';

  // Permission level helpers
  const canManageAllData = () => hasAnyRole(['owner', 'admin']);
  const canViewAllData = () => hasAnyRole(['owner', 'admin', 'auditor']);
  const canManageBranchData = () =>
    hasAnyRole(['owner', 'admin', 'branch_manager']);
  const canCorrectSales = () =>
    hasAnyRole(['owner', 'admin', 'branch_manager', 'sales_person']);
  const canVoidSales = () => hasAnyRole(['owner', 'admin', 'branch_manager']);
  const canClosePeriods = () => hasAnyRole(['owner', 'admin']);
  const canCreateSales = () =>
    hasAnyRole(['owner', 'admin', 'branch_manager', 'sales_person']);
  const canEditSales = () => hasAnyRole(['owner', 'admin', 'branch_manager']);
  const canDeleteSales = () => hasAnyRole(['owner', 'admin']);

  // Role display helpers
  const getRoleDisplayName = (role?: UserRole) => {
    switch (role || profile?.role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      case 'branch_manager':
        return 'Branch Manager';
      case 'auditor':
        return 'Auditor';
      case 'sales_person':
        return 'Sales Person';
      default:
        return 'Unknown';
    }
  };

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role || profile?.role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'branch_manager':
        return 'bg-blue-100 text-blue-800';
      case 'auditor':
        return 'bg-yellow-100 text-yellow-800';
      case 'sales_person':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return {
    hasRole,
    hasAnyRole,
    isOwner,
    isAdmin,
    isBranchManager,
    isAuditor,
    isSalesPerson,
    canManageAllData,
    canViewAllData,
    canManageBranchData,
    canCorrectSales,
    canVoidSales,
    canClosePeriods,
    canCreateSales,
    canEditSales,
    canDeleteSales,
    getRoleDisplayName,
    getRoleBadgeColor,
    currentRole: profile?.role,
  };
}
