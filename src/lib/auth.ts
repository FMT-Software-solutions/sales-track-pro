import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

    
export type UserRole = "owner" | 'admin' | 'branch_manager' | 'auditor' | 'sales_person';
export interface UserOrganization {
  organization_id: string;
  role: string;
  is_active: boolean;
  organizations: {
    id: string;
    name: string;
  };
}

export interface AuthUser extends User {
  profile?: {
    full_name: string;
    role: UserRole;
    branch_id: string | null;
    is_active: boolean;
    user_organizations?: UserOrganization[];
  };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  // Check if user is active after successful authentication
  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', data.user.id)
      .single();
    
    if (profile && profile.is_active === false) {
      // Sign out inactive user immediately
      await supabase.auth.signOut();
      throw new Error('Your account has been deactivated. Please contact your administrator.');
    }
  }
  
  return data;
}

export async function signUp(email: string, password: string, fullName: string, role: UserRole = 'branch_manager') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  
  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
        role,
      });
    
    if (profileError) throw profileError;
  }
  
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Check if user is active
  if (profile && profile.is_active === false) {
    // Sign out inactive user
    await supabase.auth.signOut();
    throw new Error('Your account has been deactivated. Please contact your administrator.');
  }

  return {
    ...user,
    profile: profile || undefined,
  };
}