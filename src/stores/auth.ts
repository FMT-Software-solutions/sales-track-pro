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
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Profile fetch error:', error);
        }

        set({
          user: {
            ...session.user,
            profile: profile || undefined,
          },
          loading: false,
        });

        console.log('Auth initialized successfully with user');
      } else {
        console.log('No session found, user not authenticated');
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
