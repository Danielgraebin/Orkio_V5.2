import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import AgentsManager from "@/components/AgentsManager";
import CollectionsManager from "@/components/CollectionsManager";
import DocumentsManager from "@/components/DocumentsManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, Loader2, MessageSquare, Shield, Users } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();

  // Fetch admin data
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.users.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: conversations, isLoading: conversationsLoading } = trpc.admin.allConversations.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  // Update user role mutation
  const updateUserRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      refetchUsers();
      toast.success("User role updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });

  if (authLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need admin privileges to access this page</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Console</h1>
                <p className="text-sm text-muted-foreground">Orkio v5 Platform Management</p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">Registered accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalConversations || 0}</div>
              <p className="text-xs text-muted-foreground">Across all organizations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMessages || 0}</div>
              <p className="text-xs text-muted-foreground">All chat messages</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="collections">Collections</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users?.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{u.name || "Unnamed User"}</div>
                          <div className="text-sm text-muted-foreground">{u.email}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            ID: {u.id} • Role: {u.role} • Joined:{" "}
                            {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {u.role === "user" ? (
                            <Button
                              size="sm"
                              onClick={() => updateUserRole.mutate({ userId: u.id, role: "admin" })}
                              disabled={updateUserRole.isPending}
                            >
                              Promote to Admin
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateUserRole.mutate({ userId: u.id, role: "user" })}
                              disabled={updateUserRole.isPending}
                            >
                              Demote to User
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Conversations</CardTitle>
                <CardDescription>Monitor conversations across all organizations</CardDescription>
              </CardHeader>
              <CardContent>
                {conversationsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversations?.map((conv) => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{conv.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Org: {conv.orgSlug} • User ID: {conv.userId}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created: {new Date(conv.createdAt).toLocaleDateString()} • Updated:{" "}
                            {new Date(conv.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/chat/${conv.orgSlug}/${conv.id}`}>View</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Management</CardTitle>
                <CardDescription>Create and manage AI agents with custom prompts and tools</CardDescription>
              </CardHeader>
              <CardContent>
                <AgentsManager orgSlug="default" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collections Tab */}
          <TabsContent value="collections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Collections Management</CardTitle>
                <CardDescription>Organize documents into collections for RAG</CardDescription>
              </CardHeader>
              <CardContent>
                <CollectionsManager orgSlug="default" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documents Management</CardTitle>
                <CardDescription>Upload and process documents for RAG search</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentsManager orgSlug="default" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
