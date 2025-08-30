import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  checkUserStatus: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  initialize: async () => {
    try {
      set({ loading: true });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session fetch error:', sessionError);
        set({ user: null, loading: false });
        return;
      }

      if (session?.user) {
        // Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
        }

        // Check if user is active
        if (profile && profile.is_active === false) {
          console.warn('Inactive user attempted to access application');
          await supabase.auth.signOut();
          set({ user: null, loading: false });
          return;
        }

        // Fetch user organizations separately
        const { data: userOrganizations, error: orgError } = await supabase
          .from('user_organizations')
          .select(`
            organization_id,
            role,
            is_active,
            organizations(
              id,
              name
            )
          `)
          .eq('user_id', session.user.id)
          .eq('is_active', true); // Only fetch active organization memberships

        if (orgError) {
          console.error('User organizations fetch error:', orgError);
        }

        // Merge profile with user organizations
        const profileWithOrgs = profile ? {
          ...profile,
          user_organizations: userOrganizations || []
        } : undefined;

        set({
          user: {
            ...session.user,
            profile: profileWithOrgs,
          },
          loading: false,
        });

      } else {
        set({ user: null });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
  checkUserStatus: async () => {
    const { user } = get();
    if (!user) return;

    try {
      // Fetch current user profile to check if still active
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking user status:', error);
        return;
      }

      // If user is now inactive, sign them out
      if (profile && profile.is_active === false) {
        console.warn('User has been deactivated, signing out...');
        await supabase.auth.signOut();
        set({ user: null });
        // Force page reload to redirect to login
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error in user status check:', error);
    }
  },
}));
