import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
import { useCreateActivityLog } from '../hooks/queries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import {
  UserPlus,
  Edit,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcwKey,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/lib/auth';
import { useRoleCheck } from '@/components/auth/RoleGuard';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  branch_id?: string;
  is_active?: boolean;
  branches?: { name: string };
  user_organizations?: Array<{
    organization_id: string;
    role: UserRole;
    is_active: boolean;
    organizations: { name: string };
  }>;
}

interface Branch {
  id: string;
  name: string;
}

interface CreateUserForm {
  email: string;
  fullName: string;
  role: UserRole;
  branchId?: string;
}

export default function UserManagement() {
  const { user: currentUser, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();
  const {
    getRoleDisplayName,
    getRoleBadgeColor,
    canManageAllData,
    canManageBranchData,
    isBranchManager,
    isOwner,
    hasRole,
  } = useRoleCheck();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    fullName: '',
    role: 'sales_person',
    branchId: undefined,
  });
  const [editForm, setEditForm] = useState<CreateUserForm>({
    email: '',
    fullName: '',
    role: 'sales_person',
    branchId: undefined,
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);

  // Get current organization from context

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: [
      'users',
      currentOrganization?.id,
      profile?.role,
      profile?.branch_id,
    ],
    queryFn: async () => {
      if (!currentOrganization) {
        throw new Error('User not associated with any organization');
      }

      // Get all users in the same organization
      const { data: orgUsers, error: orgUsersError } = await supabase
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true);

      if (orgUsersError) throw orgUsersError;

      const userIds = orgUsers?.map((ou) => ou.user_id) || [];

      // Build query for profiles - only active users
      let profilesQuery = supabase
        .from('profiles')
        .select(
          `
          *,
          branches(name)
        `
        )
        .in('id', userIds)
        .eq('is_active', true);

      // If user is branch manager, only show users from their branch
      if (isBranchManager() && profile?.branch_id) {
        profilesQuery = profilesQuery.eq('branch_id', profile.branch_id);
      }

      const {
        data: profilesData,
        error: profilesError,
      } = await profilesQuery.order('full_name');

      if (profilesError) throw profilesError;

      // Combine the data
      const usersProfiles = profilesData?.map((profile) => ({
        ...profile,
      }));

      return usersProfiles as User[];
    },
    enabled: canManageBranchData() && !!currentOrganization,
  });

  // Fetch inactive users (owner only)
  const { data: inactiveUsers, isLoading: inactiveUsersLoading } = useQuery({
    queryKey: ['inactive-users', currentOrganization?.id, profile?.role],
    queryFn: async () => {
      if (!currentOrganization) {
        throw new Error('User not associated with any organization');
      }

      // Get all inactive users in the same organization
      const { data: orgUsers, error: orgUsersError } = await supabase
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', false);

      if (orgUsersError) throw orgUsersError;

      const userIds = orgUsers?.map((ou) => ou.user_id) || [];

      // Build query for inactive profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(
          `
          *,
          branches(name)
        `
        )
        .in('id', userIds)
        .eq('is_active', false)
        .order('full_name');

      if (profilesError) throw profilesError;

      return profilesData as User[];
    },
    enabled: isOwner() && !!currentOrganization,
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['branches', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('organization_id', currentOrganization?.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Branch[];
    },
    enabled: canManageBranchData() && !!currentOrganization,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('No access token');

      if (!currentOrganization) {
        throw new Error('User not associated with any organization');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            fullName: userData.fullName,
            role: userData.role,
            branchId: userData.branchId,
            organizationId: currentOrganization.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      const result = await response.json();

      // Log the activity
      if (currentUser) {
        // Get branch name if branch_id is provided
        let branchName = null;
        if (userData.branchId) {
          const selectedBranch = branches?.find(
            (b) => b.id === userData.branchId
          );
          branchName = selectedBranch?.name || null;
        }

        await createActivityLog.mutateAsync({
          organization_id: currentOrganization.id,
          branch_id: userData.branchId || null,
          user_id: currentUser.id,
          activity_type: 'create',
          entity_type: 'user',
          entity_id: result.userId,
          description: `Created user: ${userData.fullName} (${userData.email})`,
          new_values: {
            email: userData.email,
            full_name: userData.fullName,
            role: userData.role,
            branch_id: userData.branchId,
            branch_name: branchName,
          },
          metadata: {
            email: userData.email,
            role: userData.role,
          },
        });
      }

      return result;
    },
    onSuccess: (data) => {
      setTempPassword(data.temporaryPassword);
      setPasswordCopied(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setCreateForm({
        email: '',
        fullName: '',
        role: 'sales_person',
        branchId: undefined,
      });
      toast.success('User created successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Reactivate user mutation
  const reactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Get user data before reactivation for logging
      const { data: userData } = await supabase
        .from('profiles')
        .select(
          `
          *,
          branches(name)
        `
        )
        .eq('id', userId)
        .single();

      // Get current session for authorization
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('No access token');

      // Call the reactivate-user edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reactivate-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reactivate user');
      }

      const result = await response.json();

      // Log the activity
      if (currentUser && userData) {
        await createActivityLog.mutateAsync({
          organization_id: currentOrganization?.id || '',
          branch_id: userData.branch_id || null,
          user_id: currentUser.id,
          activity_type: 'update',
          entity_type: 'user',
          entity_id: userId,
          description: `Reactivated user: ${userData.full_name} (${userData.email})`,
          new_values: {
            is_active: true,
            reactivated_at: new Date().toISOString(),
            reactivated_by: currentUser.id,
          },
          metadata: {
            email: userData.email,
            role: userData.role,
          },
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['inactive-users'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('User reactivated successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete user mutation (now deactivates instead)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Get user data before deactivation for logging (including branch name)
      const { data: userData } = await supabase
        .from('profiles')
        .select(
          `
          *,
          branches(name)
        `
        )
        .eq('id', userId)
        .single();

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('No access token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      // Log the activity
      if (currentUser && userData && currentOrganization) {
        // Enhance old values with branch name for better display
        const enhancedOldValues = {
          ...userData,
          branch_name: userData.branches?.name || null,
        };

        await createActivityLog.mutateAsync({
          organization_id: currentOrganization.id,
          branch_id: userData.branch_id,
          user_id: currentUser.id,
          activity_type: 'update',
          entity_type: 'user',
          entity_id: userId,
          description: `Deactivated user: ${userData.full_name} (${userData.email})`,
          old_values: enhancedOldValues,
          new_values: {
            ...enhancedOldValues,
            is_active: false,
            deactivated_at: new Date().toISOString(),
            deactivated_by: currentUser.id,
          },
          metadata: {
            email: userData.email,
            role: userData.role,
          },
        });
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['inactive-users'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('User deactivated successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      userData,
    }: {
      userId: string;
      userData: Partial<CreateUserForm>;
    }) => {
      // Get old user data before update
      const { data: oldUserData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // If role is being changed to admin or auditor, automatically remove branch assignment
      const branchId = ['admin', 'auditor'].includes(userData.role || '')
        ? null
        : userData.branchId || null;

      const { data: updatedData, error } = await supabase
        .from('profiles')
        .update({
          full_name: userData.fullName,
          role: userData.role,
          branch_id: branchId,
        })
        .eq('id', userId)
        .select(
          `
          *,
          branches(name)
        `
        )
        .single();

      if (error) throw error;

      // Log the activity
      if (currentUser && oldUserData && currentOrganization) {
        // Enhance old and new values with branch names for better display
        const enhancedOldValues = {
          ...oldUserData,
          branch_name: oldUserData.branches?.name || null,
        };
        const enhancedNewValues = {
          ...updatedData,
          branch_name: updatedData.branches?.name || null,
        };

        await createActivityLog.mutateAsync({
          organization_id: currentOrganization.id,
          branch_id: updatedData.branch_id,
          user_id: currentUser.id,
          activity_type: 'update',
          entity_type: 'user',
          entity_id: userId,
          description: `Updated user: ${updatedData.full_name} (${updatedData.email})`,
          old_values: enhancedOldValues,
          new_values: enhancedNewValues,
          metadata: {
            email: updatedData.email,
            role: updatedData.role,
          },
        });
      }

      return updatedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast.success('User updated successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Regenerate password mutation
  const regeneratePasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Get old user data for activity logging (including branch name)
      const { data: oldUserData } = await supabase
        .from('profiles')
        .select(
          `
          *,
          branches(name)
        `
        )
        .eq('id', userId)
        .single();

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('No access token');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-password`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate password');
      }

      const result = await response.json();

      // Log the activity
      if (currentUser && oldUserData && currentOrganization) {
        // Enhance old values with branch name for better display
        const enhancedOldValues = {
          ...oldUserData,
          branch_name: oldUserData.branches?.name || null,
        };

        await createActivityLog.mutateAsync({
          organization_id: currentOrganization.id,
          branch_id: oldUserData.branch_id,
          user_id: currentUser.id,
          activity_type: 'update',
          entity_type: 'user',
          entity_id: userId,
          description: `Regenerated password for user: ${oldUserData.full_name} (${oldUserData.email})`,
          old_values: enhancedOldValues,
          metadata: {
            email: oldUserData.email,
            action: 'password_regeneration',
          },
        });
      }

      return result;
    },
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      setPasswordCopied(false);
      setShowPassword(false);
      setIsCreateDialogOpen(true); // Reuse the create dialog to show the password
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('Password regenerated successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that branch is selected for branch managers
    if (createForm.role === 'branch_manager' && !createForm.branchId) {
      toast.error('Please select a branch for the branch manager.');
      return;
    }

    createUserMutation.mutate(createForm);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that branch is selected for branch managers
    if (editForm.role === 'branch_manager' && !editForm.branchId) {
      toast.error('Please select a branch for the branch manager.');
      return;
    }

    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        userData: editForm,
      });
    }
  };

  const handleRegeneratePassword = (userId: string) => {
    regeneratePasswordMutation.mutate(userId);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      branchId: user.branch_id || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const copyPassword = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setTempPassword(null);
    setShowPassword(false);
    setPasswordCopied(false);
  };

  // Helper function to determine if action buttons should be shown for a user
  const canShowActionButtons = (targetUser: User) => {
    // Users cannot see action buttons for themselves
    if (targetUser.id === currentUser?.id) return false;

    // No action buttons for owner users
    if (targetUser.role === 'owner') return false;

    // Only owners can manage admin users
    if (targetUser.role === 'admin' && profile?.role !== 'owner') return false;

    // Admin users cannot see action buttons for other admin users
    if (targetUser.role === 'admin' && profile?.role === 'admin') return false;

    return true;
  };

  // Check if user has access to user management
  if (!canManageBranchData()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only administrators and branch managers can manage
              users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and their permissions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="ml-auto mt-4 md:mt-0"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the platform. A temporary password will be
                generated.
              </DialogDescription>
            </DialogHeader>
            {tempPassword ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">
                    Important: Save this password!
                  </h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    This temporary password will only be shown once. Please copy
                    it and share it with the user securely.
                  </p>
                  <div className="flex items-center space-x-2">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={tempPassword}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}

                      {/* Owner-only Inactive Users Section */}
                      {isOwner() && (
                        <div className="mt-8">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h2 className="text-lg font-semibold text-muted-foreground">
                                Inactive Users
                              </h2>
                              <p className="text-sm text-muted-foreground">
                                Users who have been deactivated (Owner access
                                only)
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setShowInactiveUsers(!showInactiveUsers)
                              }
                            >
                              <Users className="mr-2 h-4 w-4" />
                              {showInactiveUsers ? 'Hide' : 'Show'} Inactive
                              Users
                              {inactiveUsers && inactiveUsers.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                  {inactiveUsers.length}
                                </Badge>
                              )}
                            </Button>
                          </div>

                          {showInactiveUsers && (
                            <div className="space-y-4">
                              {inactiveUsersLoading ? (
                                <div className="text-center py-4 text-muted-foreground">
                                  Loading inactive users...
                                </div>
                              ) : inactiveUsers && inactiveUsers.length > 0 ? (
                                <div className="grid gap-4">
                                  {inactiveUsers.map((user) => (
                                    <Card key={user.id} className="opacity-60">
                                      <CardContent className="pt-6">
                                        <div className="flex justify-between items-start">
                                          <div className="space-y-2 flex-1">
                                            <div className="flex flex-col md:flex-row md:items-center items-start md:space-x-2">
                                              <h3 className="font-semibold text-muted-foreground">
                                                {user.full_name}
                                              </h3>
                                              <Badge
                                                className={getRoleBadgeColor(
                                                  user.role
                                                )}
                                              >
                                                {getRoleDisplayName(user.role)}
                                              </Badge>
                                              <Badge variant="destructive">
                                                Inactive
                                              </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                              {user.email}
                                            </p>
                                            {user.branches && (
                                              <p className="text-sm text-muted-foreground">
                                                Branch: {user.branches.name}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  disabled={
                                                    reactivateUserMutation.isPending
                                                  }
                                                  className="text-green-600 border-green-200 hover:bg-green-50"
                                                >
                                                  <UserCheck className="h-4 w-4" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>
                                                    Reactivate User
                                                  </AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    Are you sure you want to
                                                    reactivate user "
                                                    {user.full_name}"? They will
                                                    be able to log in again and
                                                    access the system.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>
                                                    Cancel
                                                  </AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() =>
                                                      reactivateUserMutation.mutate(
                                                        user.id
                                                      )
                                                    }
                                                    className="bg-green-600 text-white hover:bg-green-700"
                                                  >
                                                    Reactivate
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                  No inactive users found.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyPassword}
                      className={
                        passwordCopied ? 'bg-green-50 border-green-200' : ''
                      }
                    >
                      {passwordCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button onClick={closeCreateDialog} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={createForm.fullName}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, fullName: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(value: UserRole) =>
                      setCreateForm({
                        ...createForm,
                        role: value,
                        // Clear branch assignment when role doesn't require branch
                        branchId: ['admin', 'auditor'].includes(value)
                          ? undefined
                          : createForm.branchId,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canManageAllData() && (
                        <>
                          {isOwner() && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                          <SelectItem value="auditor">Auditor</SelectItem>
                          <SelectItem value="branch_manager">
                            Branch Manager
                          </SelectItem>
                        </>
                      )}
                      <SelectItem value="sales_person">Sales Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {['branch_manager', 'sales_person'].includes(
                  createForm.role
                ) && (
                  <div>
                    <Label htmlFor="branch">
                      Branch <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={createForm.branchId}
                      onValueChange={(value) =>
                        setCreateForm({ ...createForm, branchId: value })
                      }
                      required
                    >
                      <SelectTrigger
                        className={!createForm.branchId ? 'border-red-300' : ''}
                      >
                        <SelectValue placeholder="Select a branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="flex-1"
                  >
                    {createUserMutation.isPending
                      ? 'Creating...'
                      : 'Create User'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCreateDialog}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {usersLoading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : (
        <div className="grid gap-4">
          {users?.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-col md:flex-row md:items-center items-start md:space-x-2">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleDisplayName(user.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    {user.branches && (
                      <p className="text-sm text-muted-foreground">
                        Branch: {user.branches.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col md:flex-row justify-center items-baseline space-x-2 space-y-1">
                    {/* Edit button visibility based on role hierarchy */}
                    {canShowActionButtons(user) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Regenerate password button visibility based on role hierarchy */}
                    {canShowActionButtons(user) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={regeneratePasswordMutation.isPending}
                            title="Regenerate Password"
                          >
                            <RotateCcwKey className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Regenerate Password
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to regenerate the password
                              for "{user.full_name}"? This will invalidate their
                              current password and they will need to use the new
                              temporary password to log in.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRegeneratePassword(user.id)}
                            >
                              Regenerate Password
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {/* Delete button visibility based on role hierarchy */}
                    {canShowActionButtons(user) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deleteUserMutation.isPending}
                          >
                            <UserX className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to deactivate user "
                              {user.full_name}"? They will no longer be able to
                              log in, but their data will be preserved. Only
                              owners can reactivate deactivated users.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Deactivate
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inactive Users Section - Owner Only */}
      {hasRole('owner') && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-muted-foreground">
                Inactive Users
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInactiveUsers(!showInactiveUsers)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showInactiveUsers ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show ({inactiveUsers?.length || 0})
                </>
              )}
            </Button>
          </div>

          {showInactiveUsers && (
            <div className="space-y-4">
              {inactiveUsersLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading inactive users...
                </div>
              ) : inactiveUsers && inactiveUsers.length > 0 ? (
                <div className="grid gap-4">
                  {inactiveUsers.map((user) => (
                    <Card
                      key={user.id}
                      className="border-dashed border-muted-foreground/30"
                    >
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-col md:flex-row md:items-center items-start md:space-x-2">
                              <h3 className="font-semibold text-muted-foreground">
                                {user.full_name}
                              </h3>
                              <Badge variant="secondary" className="bg-muted">
                                {getRoleDisplayName(user.role)}
                              </Badge>
                              <Badge variant="destructive" className="text-xs">
                                Inactive
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {user.email}
                            </p>
                            {user.branches && (
                              <p className="text-sm text-muted-foreground">
                                Branch: {user.branches.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={reactivateUserMutation.isPending}
                                  className="border-green-200 text-green-700 hover:bg-green-50"
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Reactivate
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Reactivate User
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to reactivate "
                                    {user.full_name}"? This will restore their
                                    access to the system and they will be able
                                    to log in again.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      reactivateUserMutation.mutate(user.id)
                                    }
                                    className="bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Reactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No inactive users found.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed
              </p>
            </div>
            <div>
              <Label htmlFor="editFullName">Full Name</Label>
              <Input
                id="editFullName"
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm({ ...editForm, fullName: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) =>
                  setEditForm({
                    ...editForm,
                    role: value,
                    // Clear branch assignment when role doesn't require branch
                    branchId: ['admin', 'auditor'].includes(value)
                      ? undefined
                      : editForm.branchId,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canManageAllData() && (
                    <>
                      {isOwner() && (
                        <SelectItem value="admin">Admin</SelectItem>
                      )}
                      <SelectItem value="auditor">Auditor</SelectItem>
                      <SelectItem value="branch_manager">
                        Branch Manager
                      </SelectItem>
                    </>
                  )}
                  <SelectItem value="sales_person">Sales Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {['branch_manager', 'sales_person'].includes(editForm.role) && (
              <div>
                <Label htmlFor="editBranch">
                  Branch <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={editForm.branchId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, branchId: value })
                  }
                  required
                >
                  <SelectTrigger
                    className={!editForm.branchId ? 'border-red-300' : ''}
                  >
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex space-x-2">
              <Button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="flex-1"
              >
                {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
