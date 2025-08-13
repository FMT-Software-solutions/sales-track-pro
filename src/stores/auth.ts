import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
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
          .eq('user_id', session.user.id);

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
}));
