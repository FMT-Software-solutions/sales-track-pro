import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useCreateActivityLog } from '../../hooks/queries';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { RotateCcwKey, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/lib/auth';

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

interface UserActionDialogsProps {
  onPasswordRegenerated: (tempPassword: string) => void;
}

export default function UserActionDialogs({ onPasswordRegenerated }: UserActionDialogsProps) {
  const { user: currentUser } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();
  
  // State for regenerate password dialog
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  
  // State for delete/deactivate user dialog
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
      onPasswordRegenerated(data.tempPassword);
      setIsPasswordDialogOpen(false);
      setSelectedUserForPassword(null);
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('Password regenerated successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
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
        throw new Error(error.error || 'Failed to deactivate user');
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
          activity_type: 'delete',
          entity_type: 'user',
          entity_id: userId,
          description: `Deactivated user: ${oldUserData.full_name} (${oldUserData.email})`,
          old_values: enhancedOldValues,
          metadata: {
            email: oldUserData.email,
            action: 'user_deactivation',
          },
        });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['inactive-users'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      setIsDeleteDialogOpen(false);
      setSelectedUserForDelete(null);
      toast.success('User deactivated successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const openPasswordDialog = (user: User) => {
    setSelectedUserForPassword(user);
    setIsPasswordDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUserForDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleRegeneratePassword = () => {
    if (selectedUserForPassword) {
      regeneratePasswordMutation.mutate(selectedUserForPassword.id);
    }
  };

  const handleDeleteUser = () => {
    if (selectedUserForDelete) {
      deleteUserMutation.mutate(selectedUserForDelete.id);
    }
  };

  return {
    // Action buttons
    RegeneratePasswordButton: ({ user, disabled }: { user: User; disabled?: boolean }) => (
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || regeneratePasswordMutation.isPending}
        title="Regenerate Password"
        onClick={() => openPasswordDialog(user)}
      >
        <RotateCcwKey className="h-4 w-4" />
      </Button>
    ),
    
    DeleteUserButton: ({ user, disabled }: { user: User; disabled?: boolean }) => (
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || deleteUserMutation.isPending}
        onClick={() => openDeleteDialog(user)}
      >
        <UserX className="h-4 w-4 text-destructive" />
      </Button>
    ),

    // Dialog components
    Dialogs: () => (
      <>
        {/* Regenerate Password Dialog */}
        <AlertDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate Password</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to regenerate the password for "{selectedUserForPassword?.full_name}"? 
                This will invalidate their current password and they will need to use the new temporary password to log in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsPasswordDialogOpen(false);
                setSelectedUserForPassword(null);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRegeneratePassword}>
                Regenerate Password
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete/Deactivate User Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to deactivate user "{selectedUserForDelete?.full_name}"? 
                They will no longer be able to log in. You will need to contact your admin if you decide to reactive this user.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedUserForDelete(null);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    ),
  };
}