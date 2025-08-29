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
    user_organizations?: UserOrganization[];
  };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
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
  
  return {
    ...user,
    profile: profile || undefined,
  };
}