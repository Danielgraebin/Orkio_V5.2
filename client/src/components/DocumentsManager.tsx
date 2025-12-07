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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DocumentsManagerProps {
  orgSlug: string;
}

export default function DocumentsManager({ orgSlug }: DocumentsManagerProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [collectionId, setCollectionId] = useState<string>("");

  const { data: documents, isLoading, refetch } = trpc.documents.list.useQuery({ orgSlug });
  const { data: collections } = trpc.collections.list.useQuery({ orgSlug });

  const uploadDocument = trpc.documents.upload.useMutation({
    onSuccess: () => {
      refetch();
      setIsUploadOpen(false);
      setFile(null);
      setCollectionId("");
      toast.success("Document uploaded and processed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });

  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Document deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });

  const handleUpload = async () => {
    if (!file) return;

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const content = base64.split(",")[1]; // Remove data:mime;base64, prefix

      uploadDocument.mutate({
        name: file.name,
        content,
        mimeType: file.type,
        collectionId: collectionId ? parseInt(collectionId) : undefined,
        orgSlug,
      });
    };
    reader.readAsDataURL(file);
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
          <h3 className="text-lg font-medium">Documents</h3>
          <p className="text-sm text-muted-foreground">
            {documents?.length || 0} document(s) uploaded
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen} modal={true}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a document to process for RAG search
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="collection">Collection (Optional)</Label>
                <Select value={collectionId} onValueChange={setCollectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections?.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id.toString()}>
                        {collection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploadDocument.isPending || !file}>
                {uploadDocument.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload & Process
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents?.map((document) => (
          <Card key={document.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <FileText className="w-5 h-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{document.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {document.status === "completed" && "✓ Processed"}
                      {document.status === "processing" && "⏳ Processing..."}
                      {document.status === "failed" && "✗ Failed"}
                      {document.status === "pending" && "⏸ Pending"}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteDocument.mutate({ id: document.id })}
                  disabled={deleteDocument.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Type: {document.mimeType}</div>
                <div>Uploaded: {new Date(document.createdAt).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
