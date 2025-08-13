import { useState } from 'react';
import { useSalesItems, useDeleteSalesItem, SalesItem } from '@/hooks/queries';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { SalesItemForm } from '@/components/forms/SalesItemForm';
import { Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function SalesItemsManager() {
  const { currentOrganization } = useOrganization();
  const { data: salesItems = [] } = useSalesItems(currentOrganization?.id);
  const deleteSalesItem = useDeleteSalesItem();
  const { searchValue, debouncedSearchValue, setSearchValue } = useDebouncedSearch('', 500);
  const [editItem, setEditItem] = useState<SalesItem | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter items by debounced search
  const filteredItems = salesItems.filter((item: SalesItem) =>
    item.name.toLowerCase().includes(debouncedSearchValue.toLowerCase()) ||
    (item.description?.toLowerCase().includes(debouncedSearchValue.toLowerCase()) ?? false)
  );

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleEdit = (item: SalesItem) => {
    setEditItem(item);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSalesItem.mutateAsync(id);
      toast.success('Sales item deleted successfully');
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Failed to delete sales item');
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    setPage(1);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setEditItem(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Sales Items</CardTitle>
            <CardDescription>
              Manage your sales items and their prices.
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Sales Item</DialogTitle>
              </DialogHeader>
              <SalesItemForm onSuccess={handleCreateSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
          <Input
            type="text"
            placeholder="Search items..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-64"
          />
        </div>
        
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item: SalesItem) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-green-600">
                    {currentOrganization?.currency || 'GH₵'} {item.price?.toFixed(2) || '0.00'}
                  </TableCell>
                  <TableCell>{item.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Sales Item</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{item.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No sales items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Sales Item</DialogTitle>
            </DialogHeader>
            {editItem && (
              <SalesItemForm salesItem={editItem} onSuccess={handleEditSuccess} />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}