import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCreateOrganization } from '@/hooks/queries';
import { toast } from 'sonner';
import { Building2, Plus } from 'lucide-react';

const enableOrgCreation = false;

export function OrganizationSelector() {
  const {
    currentOrganization,
    userOrganizations,
    setCurrentOrganization,
  } = useOrganization();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  const createOrganizationMutation = useCreateOrganization();

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const newOrg = await createOrganizationMutation.mutateAsync({
        name: newOrgName.trim(),
      });

      toast.success('Organization created successfully');
      setIsCreateDialogOpen(false);
      setNewOrgName('');

      // Switch to the new organization
      setCurrentOrganization(newOrg);
    } catch (error) {
      toast.error('Failed to create organization');
    }
  };

  // Filter for active memberships and remove duplicates
  const uniqueOrganizations =
    userOrganizations?.filter(
      (userOrg, index, self) =>
        userOrg.is_active &&
        userOrg.organizations &&
        self.findIndex(
          (item) => item.organizations?.id === userOrg.organizations?.id
        ) === index
    ) || [];

  const handleOrganizationChange = (organizationId: string) => {
    const selectedOrg = uniqueOrganizations.find(
      (userOrg) => userOrg.organizations?.id === organizationId
    )?.organizations;

    if (selectedOrg) {
      setCurrentOrganization(selectedOrg);
    }
  };

  if (uniqueOrganizations.length === 0) {
    return (
      <div className="flex items-center space-x-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No organizations</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentOrganization?.id || ''}
        onValueChange={handleOrganizationChange}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          {uniqueOrganizations.map((userOrg, index) => (
            <SelectItem
              key={`${userOrg.organizations?.id}-${index}`}
              value={userOrg.organizations?.id || ''}
            >
              <div className="flex flex-col">
                <span>{userOrg.organizations?.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {enableOrgCreation && (
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to manage your business operations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Enter organization name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={createOrganizationMutation.isPending}
              >
                {createOrganizationMutation.isPending
                  ? 'Creating...'
                  : 'Create Organization'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
