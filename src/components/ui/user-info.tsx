import { useAuthStore } from '@/stores/auth';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface UserInfoProps {
  userId: string | null;
  userProfile?: {
    id: string;
    full_name: string;
  } | null;
  label: string;
  className?: string;
}

export function UserInfo({ userId, userProfile, label, className = "" }: UserInfoProps) {
  const { user } = useAuthStore();
  const { canViewAllData } = useRoleCheck();
  
  // Don't show if no user ID
  if (!userId) return null;
  
  // Only show to users who can view all data (owner, admin, auditor)
  if (!canViewAllData()) return null;
  
  // Determine display name
  const isCurrentUser = userId === user?.id;
  const displayName = isCurrentUser 
    ? 'You' 
    : userProfile?.full_name || 'Unknown User';
  
  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      <span className="font-medium">{label}:</span> {displayName}
    </div>
  );
}