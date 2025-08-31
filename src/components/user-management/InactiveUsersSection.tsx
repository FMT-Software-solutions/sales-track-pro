import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useCreateActivityLog } from '../../hooks/queries';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
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
import { Badge } from '../ui/badge';
import {
  Eye,
  EyeOff,
  UserCheck,
  Users,
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

export default function InactiveUsersSection() {
  const { user: currentUser, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const createActivityLog = useCreateActivityLog();
  const {
    getRoleDisplayName,
    isOwner,
    hasRole,
  } = useRoleCheck();
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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

  // Only render if user is owner
  if (!hasRole('owner')) {
    return null;
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-md font-semibold text-muted-foreground">
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
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reactivateUserMutation.isPending}
                          className="border-green-200 text-green-700 hover:bg-green-50"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsDialogOpen(true);
                          }}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Reactivate
                        </Button>
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

      {/* Single reusable dialog instance */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reactivate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reactivate "
              {selectedUser?.full_name}"? This will restore their
              access to the system and they will be able
              to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDialogOpen(false);
              setSelectedUser(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedUser) {
                  reactivateUserMutation.mutate(selectedUser.id);
                  setIsDialogOpen(false);
                  setSelectedUser(null);
                }
              }}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}