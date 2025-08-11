import { useState } from 'react';
import { useBranches } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BranchForm } from '@/components/forms/BranchForm';
import { Plus, MapPin, Calendar, Edit } from 'lucide-react';
import { format } from 'date-fns';
import type { Database } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Branch = Database['public']['Tables']['branches']['Row'];

export function Branches() {
  const { data: branches = [], isLoading } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<Branch | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setSelectedBranch(undefined);
  };

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedBranch(undefined);
    setIsDialogOpen(true);
  };

  // Filter branches by search and status
  const filteredBranches = branches.filter((branch) => {
    const matchesSearch =
      branch.name.toLowerCase().includes(search.toLowerCase()) ||
      (branch.description?.toLowerCase().includes(search.toLowerCase()) ??
        false) ||
      branch.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && branch.is_active) ||
      (statusFilter === 'inactive' && !branch.is_active);
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Branch Management
          </h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-gray-100 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 flex-wrap space-y-4">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Branch Management
          </h1>
          <p className="text-muted-foreground">
            Manage your food vendor branches and locations
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-wrap">
          <Input
            type="text"
            placeholder="Search branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <Tabs
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as 'all' | 'active' | 'inactive')
              }
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
            </Tabs>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add <span className="hidden md:inline">Branch</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {selectedBranch ? 'Edit Branch' : 'Create New Branch'}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedBranch
                      ? 'Update the branch information below.'
                      : 'Fill in the details to create a new branch.'}
                  </DialogDescription>
                </DialogHeader>
                <BranchForm branch={selectedBranch} onSuccess={handleSuccess} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBranches.map((branch) => (
          <Card key={branch.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{branch.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(branch)}
                    className="p-2 "
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center text-sm text-lime-800">
                <MapPin className="mr-1 h-4 w-4" />
                {branch.location}
              </div>
            </CardHeader>
            <CardContent>
              {branch.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {branch.description}
                </p>
              )}
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="mr-1 h-3 w-3" />
                Created {format(new Date(branch.created_at), 'MMM d, yyyy')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBranches.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No branches found
            </h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search or filter options.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Branch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
