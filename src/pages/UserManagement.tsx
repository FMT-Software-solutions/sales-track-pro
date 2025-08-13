import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '../contexts/OrganizationContext';
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
  Trash2,
  UserPlus,
  Edit,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcwKey,
} from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'branch_manager';
  branch_id?: string;
  branches?: { name: string };
  user_organizations?: Array<{
    organization_id: string;
    role: string;
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
  role: 'admin' | 'branch_manager';
  branchId?: string;
}

export default function UserManagement() {
  const { user: currentUser, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    fullName: '',
    role: 'branch_manager',
    branchId: undefined,
  });
  const [editForm, setEditForm] = useState<CreateUserForm>({
    email: '',
    fullName: '',
    role: 'branch_manager',
    branchId: undefined,
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Get current organization from context

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', currentOrganization?.id],
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

      // Get profiles for users in the organization
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(
          `
          *,
          branches(name)
        `
        )
        .in('id', userIds)
        .order('full_name');

      if (profilesError) throw profilesError;

      // Combine the data
      const usersProfiles = profilesData?.map((profile) => ({
        ...profile,
      }));

      return usersProfiles as User[];
    },
    enabled: profile?.role === 'admin' && !!currentOrganization,
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
    enabled: profile?.role === 'admin' && !!currentOrganization,
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

      return response.json();
    },
    onSuccess: (data) => {
      setTempPassword(data.temporaryPassword);
      setPasswordCopied(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateForm({
        email: '',
        fullName: '',
        role: 'branch_manager',
        branchId: undefined,
      });
      toast.success('User created successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
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

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully!');
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
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userData.fullName,
          role: userData.role,
          branch_id: userData.branchId || null,
        })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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

      return response.json();
    },
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      setPasswordCopied(false);
      setShowPassword(false);
      setIsCreateDialogOpen(true); // Reuse the create dialog to show the password
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

  const handleDeleteUser = (userId: string, userName: string) => {
    if (
      confirm(
        `Are you sure you want to delete user "${userName}"? This action cannot be undone.`
      )
    ) {
      deleteUserMutation.mutate(userId);
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

  // Check if user is admin
  if (profile?.role !== 'admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only administrators can manage users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and their permissions
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
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
                    onValueChange={(value: 'admin' | 'branch_manager') =>
                      setCreateForm({ ...createForm, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="branch_manager">
                        Branch Manager
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createForm.role === 'branch_manager' && (
                  <div>
                    <Label htmlFor="branch">Branch <span className="text-red-500">*</span></Label>
                    <Select
                      value={createForm.branchId}
                      onValueChange={(value) =>
                        setCreateForm({ ...createForm, branchId: value })
                      }
                      required
                    >
                      <SelectTrigger className={!createForm.branchId ? "border-red-300" : ""}>
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
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role === 'admin' ? 'Admin' : 'Branch Manager'}
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
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
                            Are you sure you want to regenerate the password for
                            "{user.full_name}"? This will invalidate their
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
                    {user.id !== currentUser?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDeleteUser(user.id, user.full_name)
                        }
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
                onValueChange={(value: 'admin' | 'branch_manager') =>
                  setEditForm({ ...editForm, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.role === 'branch_manager' && (
              <div>
                <Label htmlFor="editBranch">Branch <span className="text-red-500">*</span></Label>
                <Select
                  value={editForm.branchId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, branchId: value })
                  }
                  required
                >
                  <SelectTrigger className={!editForm.branchId ? "border-red-300" : ""}>
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
