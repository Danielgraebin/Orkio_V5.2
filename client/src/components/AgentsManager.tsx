import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentsManagerProps {
  orgSlug: string;
}

export default function AgentsManager({ orgSlug }: AgentsManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    model: "gpt-4o",
    temperature: 7,
    enableRAG: false,
    enableSTT: false,
    enableWebSearch: false,
  });

  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery({ orgSlug });

  const createAgent = trpc.agents.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateOpen(false);
      setNewAgent({
        name: "",
        description: "",
        systemPrompt: "",
        model: "gpt-4o",
        temperature: 7,
        enableRAG: false,
        enableSTT: false,
        enableWebSearch: false,
      });
      toast.success("Agent created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create agent: ${error.message}`);
    },
  });

  const deleteAgent = trpc.agents.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Agent deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete agent: ${error.message}`);
    },
  });

  const updateAgent = trpc.agents.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingAgent(null);
      toast.success("Agent updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update agent: ${error.message}`);
    },
  });

  const openEditModal = (agent: any) => {
    setEditingAgent({
      id: agent.id,
      name: agent.name,
      description: agent.description || "",
      systemPrompt: agent.systemPrompt || "",
      model: agent.model || "gpt-4o",
      temperature: agent.temperature || 7,
      enableRAG: agent.tools?.includes("RAG") || false,
      enableSTT: agent.tools?.includes("STT") || false,
      enableWebSearch: agent.tools?.includes("WebSearch") || false,
    });
  };

  const handleCreate = () => {
    createAgent.mutate({ ...newAgent, orgSlug });
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
          <h3 className="text-lg font-medium">Agents</h3>
          <p className="text-sm text-muted-foreground">
            {agents?.length || 0} agent(s) configured
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen} modal={true}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent with custom prompts and tools
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="My Assistant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="A helpful AI assistant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                  placeholder="You are a helpful AI assistant..."
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={newAgent.model}
                  onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
                  placeholder="gpt-4o"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature (0-10)</Label>
                <Input
                  id="temperature"
                  type="number"
                  min="0"
                  max="10"
                  value={newAgent.temperature}
                  onChange={(e) => setNewAgent({ ...newAgent, temperature: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-4">
                <Label>Tools</Label>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableRAG" className="cursor-pointer">
                    Enable RAG (Document Search)
                  </Label>
                  <Switch
                    id="enableRAG"
                    checked={newAgent.enableRAG}
                    onCheckedChange={(checked) => setNewAgent({ ...newAgent, enableRAG: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableSTT" className="cursor-pointer">
                    Enable STT (Voice Input)
                  </Label>
                  <Switch
                    id="enableSTT"
                    checked={newAgent.enableSTT}
                    onCheckedChange={(checked) => setNewAgent({ ...newAgent, enableSTT: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableWebSearch" className="cursor-pointer">
                    Enable Web Search
                  </Label>
                  <Switch
                    id="enableWebSearch"
                    checked={newAgent.enableWebSearch}
                    onCheckedChange={(checked) =>
                      setNewAgent({ ...newAgent, enableWebSearch: checked })
                    }
                  />
                </div>
              </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createAgent.isPending || !newAgent.name}>
                {createAgent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {agents?.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{agent.name}</CardTitle>
                  <CardDescription>{agent.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(agent)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAgent.mutate({ id: agent.id })}
                    disabled={deleteAgent.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Model:</span> {agent.model}
                </div>
                <div>
                  <span className="font-medium">Temperature:</span> {agent.temperature}/10
                </div>
                <div>
                  <span className="font-medium">Tools:</span>{" "}
                  {[
                    agent.enableRAG && "RAG",
                    agent.enableSTT && "STT",
                    agent.enableWebSearch && "Web Search",
                  ]
                    .filter(Boolean)
                    .join(", ") || "None"}
                </div>
                <div>
                  <span className="font-medium">System Prompt:</span>
                  <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                    {agent.systemPrompt}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Agent Dialog */}
      {editingAgent && (
        <Dialog open={!!editingAgent} onOpenChange={() => setEditingAgent(null)} modal={true}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Update the agent configuration and tools.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editingAgent.name}
                    onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    placeholder="My Custom Agent"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editingAgent.description}
                    onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                    placeholder="A helpful assistant for..."
                  />
                </div>
                <div>
                  <Label htmlFor="edit-systemPrompt">System Prompt</Label>
                  <Textarea
                    id="edit-systemPrompt"
                    value={editingAgent.systemPrompt}
                    onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                    placeholder="You are a helpful assistant that..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-model">Model</Label>
                  <Select
                    value={editingAgent.model}
                    onValueChange={(value) => setEditingAgent({ ...editingAgent, model: value })}
                  >
                    <SelectTrigger id="edit-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="o1">O1</SelectItem>
                      <SelectItem value="o1-mini">O1 Mini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-temperature">
                    Temperature: {editingAgent.temperature}/10
                  </Label>
                  <Input
                    id="edit-temperature"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={editingAgent.temperature}
                    onChange={(e) =>
                      setEditingAgent({ ...editingAgent, temperature: parseInt(e.target.value, 10) })
                    }
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <Label>Tools</Label>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-enableRAG" className="cursor-pointer">
                      Enable RAG (Document Search)
                    </Label>
                    <Switch
                      id="edit-enableRAG"
                      checked={editingAgent.enableRAG}
                      onCheckedChange={(checked) =>
                        setEditingAgent({ ...editingAgent, enableRAG: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-enableSTT" className="cursor-pointer">
                      Enable STT (Voice Input)
                    </Label>
                    <Switch
                      id="edit-enableSTT"
                      checked={editingAgent.enableSTT}
                      onCheckedChange={(checked) =>
                        setEditingAgent({ ...editingAgent, enableSTT: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-enableWebSearch" className="cursor-pointer">
                      Enable Web Search
                    </Label>
                    <Switch
                      id="edit-enableWebSearch"
                      checked={editingAgent.enableWebSearch}
                      onCheckedChange={(checked) =>
                        setEditingAgent({ ...editingAgent, enableWebSearch: checked })
                      }
                    />
                  </div>
                </div>
              </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingAgent(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const { id, ...data } = editingAgent;
                  updateAgent.mutate({ id, orgSlug, ...data });
                }}
                disabled={updateAgent.isPending || !editingAgent.name}
              >
                {updateAgent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
