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
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AgentsManagerProps {
  orgSlug: string;
}

export default function AgentsManager({ orgSlug }: AgentsManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Configure a new AI agent with custom prompts and tools
              </DialogDescription>
            </DialogHeader>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAgent.mutate({ id: agent.id })}
                  disabled={deleteAgent.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
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
    </div>
  );
}
