import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRoute } from "wouter";
import { Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type Agent = { id: number; name: string; enableRAG?: boolean; orgSlug: string };
type Doc = { id: number; name: string; status: "pending"|"queued"|"processing"|"completed"|"failed"; mimeType: string | null; createdAt: Date | string };

export default function AgentsManager() {
  const { user, loading: authLoading } = useAuth();
  const [, params] = useRoute("/agents/:orgSlug");
  const orgSlug = params?.orgSlug || "default";
  
  const agents = trpc.agents.list.useQuery({ orgSlug }, { enabled: !!user });
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!agent && agents.data?.length) setAgent(agents.data[0] as any);
  }, [agents.data, agent]);

  const agentDetails = trpc.agents.get.useQuery(
    { id: agent?.id ?? 0 },
    { enabled: !!agent?.id }
  );

  const ensureKb = trpc.agents.ensureKb.useMutation({
    onSuccess: () => kb.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const kbId = agentDetails.data?.kbCollectionId as number | undefined;

  const kb = trpc.documents.listByCollection.useQuery(
    { collectionId: kbId! },
    { enabled: !!kbId }
  );

  const upload = trpc.documents.upload.useMutation({
    onSuccess: () => { kb.refetch(); toast.success("Uploaded"); },
    onError: (e) => toast.error(e.message),
  });

  const del = trpc.documents.delete.useMutation({
    onSuccess: () => { kb.refetch(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent) return;

    try {
      // garante a KB
      if (!kbId) {
        await ensureKb.mutateAsync({ id: agent.id });
      }
      const currKb = kbId || (await agentDetails.refetch()).data?.kbCollectionId;
      if (!currKb) throw new Error("KB not available");

      const max = 16; // MB
      if (file.size / 1024 / 1024 > max) {
        toast.error(`Max ${max} MB`);
        e.target.value = "";
        return;
      }

      const b64 = await toBase64(file);
      upload.mutate({
        name: file.name,
        content: (b64.split(",")[1] || b64),
        mimeType: file.type || "application/octet-stream",
        collectionId: currKb as number,
        orgSlug,
      } as any);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      e.target.value = "";
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to access Agents Manager.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader><CardTitle>Agents</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {agents.isLoading && <Loader2 className="w-6 h-6 animate-spin" />}
          {agents.data?.map(a => (
            <Button
              key={a.id}
              variant={a.id === agent?.id ? "default" : "outline"}
              onClick={() => setAgent(a as any)}
            >
              {a.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      {agent && (
        <Tabs defaultValue="kb" className="space-y-4">
          <TabsList>
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="advanced">Avançado (Collections)</TabsTrigger>
          </TabsList>

          {/* KB padrão do agente (agent-{id}) */}
          <TabsContent value="kb">
            <Card>
              <CardHeader>
                <CardTitle>KB padrão do agente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Esta aba usa automaticamente a coleção <code>agent-{agent.id}</code> como base de conhecimento do agente.
                </div>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".txt,.md,.pdf,.doc,.docx" onChange={onFile} disabled={upload.isPending} />
                  {upload.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <div className="grid gap-2">
                  {kb.isLoading && <Loader2 className="w-6 h-6 animate-spin" />}
                  {kb.data?.length ? kb.data.map((d: Doc) => (
                    <div key={d.id} className="flex items-center justify-between border rounded p-2 text-sm">
                      <div>{d.name} · <span className={d.status === "completed" ? "text-green-600" : d.status === "failed" ? "text-red-600" : "text-yellow-600"}>{d.status}</span></div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => del.mutate({ id: d.id } as any)} disabled={del.isPending}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )) : <div className="text-sm text-muted-foreground">Nenhum documento nesta KB.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações enxutas */}
          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable RAG</Label>
                  <Switch checked={!!(agent as any).enableRAG} disabled />
                </div>
                <div className="text-sm text-muted-foreground">
                  Para editar configurações completas do agente, use o Admin Console.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Avançado: Collections múltiplas */}
          <TabsContent value="advanced">
            <Card>
              <CardHeader><CardTitle>Vincular Collections</CardTitle></CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Use esta aba para vincular múltiplas collections ao agente (modo avançado).
                  Para gerenciar collections vinculadas, use o Admin Console → Agents.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
