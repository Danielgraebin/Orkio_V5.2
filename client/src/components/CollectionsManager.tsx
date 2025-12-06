import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CollectionsManagerProps {
  orgSlug: string;
}

export default function CollectionsManager({ orgSlug }: CollectionsManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCollection, setNewCollection] = useState({
    name: "",
    description: "",
  });

  const { data: collections, isLoading, refetch } = trpc.collections.list.useQuery({ orgSlug });

  const createCollection = trpc.collections.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateOpen(false);
      setNewCollection({ name: "", description: "" });
      toast.success("Collection created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create collection: ${error.message}`);
    },
  });

  const deleteCollection = trpc.collections.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Collection deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete collection: ${error.message}`);
    },
  });

  const handleCreate = () => {
    createCollection.mutate({ ...newCollection, orgSlug });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Collections</h3>
          <p className="text-sm text-muted-foreground">
            {collections?.length || 0} collection(s) configured
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
              <DialogDescription>
                Create a collection to organize documents for RAG
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="Product Documentation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newCollection.description}
                  onChange={(e) =>
                    setNewCollection({ ...newCollection, description: e.target.value })
                  }
                  placeholder="Collection of product-related documents"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createCollection.isPending || !newCollection.name}
              >
                {createCollection.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Collection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections?.map((collection) => (
          <Card key={collection.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{collection.name}</CardTitle>
                  <CardDescription className="text-sm">{collection.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCollection.mutate({ id: collection.id })}
                  disabled={deleteCollection.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Created: {new Date(collection.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
