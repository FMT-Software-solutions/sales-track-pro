import { useAuthStore } from '@/stores/auth';

export function useAuth() {
  const { user, loading } = useAuthStore();
  
  return {
    user,
    profile: user?.profile,
    loading,
    isAuthenticated: !!user,
  };
}