import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Loader2, MessageSquare, Mic, MicOff, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/chat/:orgSlug/:conversationId?");
  
  const orgSlug = params?.orgSlug || "default";
  const conversationId = params?.conversationId ? parseInt(params.conversationId) : null;

  const [message, setMessage] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [localMessages, setLocalMessages] = useState<Array<{ role: string; content: string }>>([]);

  // Fetch conversations list
  const { data: conversations, refetch: refetchConversations } = trpc.conversations.list.useQuery(
    { orgSlug },
    { enabled: !!user }
  );

  const { data: agents } = trpc.agents.list.useQuery({ orgSlug }, { enabled: !!user });

  // Fetch current conversation
  const { data: conversationData, refetch: refetchConversation } = trpc.conversations.get.useQuery(
    { id: conversationId!, orgSlug },
    { enabled: !!conversationId && !!user }
  );

  // Create conversation mutation
  const createConversation = trpc.conversations.create.useMutation({
    onSuccess: (data) => {
      refetchConversations();
      setLocation(`/chat/${orgSlug}/${data.id}`);
      toast.success("New conversation created");
    },
  });

  // Delete conversation mutation
  const deleteConversation = trpc.conversations.delete.useMutation({
    onSuccess: () => {
      refetchConversations();
      setLocation(`/chat/${orgSlug}`);
      toast.success("Conversation deleted");
    },
  });

  // Transcribe audio mutation
  const transcribeAudio = trpc.stt.transcribe.useMutation({
    onSuccess: (data) => {
      setMessage(data.text);
      toast.success("Audio transcribed successfully");
    },
    onError: (error) => {
      toast.error(`Transcription failed: ${error.message}`);
    },
  });

  // Send message mutation
  const sendMessage = trpc.chat.stream.useMutation({
    onSuccess: (data) => {
      setLocalMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      refetchConversation();
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });

  // Update local messages when conversation data changes
  useEffect(() => {
    if (conversationData?.messages) {
      setLocalMessages(conversationData.messages.map(m => ({ role: m.role, content: m.content })));
    } else {
      setLocalMessages([]);
    }
  }, [conversationData]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          transcribeAudio.mutate({
            audioData: base64,
            mimeType: "audio/webm",
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      toast.error("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !conversationId) return;

    const userMessage = message.trim();
    setMessage("");
    setLocalMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    await sendMessage.mutateAsync({
      conversationId,
      message: userMessage,
      orgSlug,
    });
  };

  const handleNewConversation = () => {
    const title = `Conversation ${(conversations?.length || 0) + 1}`;
    createConversation.mutate({ title, orgSlug });
  };

  const handleDeleteConversation = (id: number) => {
    if (confirm("Are you sure you want to delete this conversation?")) {
      deleteConversation.mutate({ id, orgSlug });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Please log in to access chat</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Conversations List */}
      <div className="w-64 border-r border-border bg-card">
        <div className="p-4">
          <Button onClick={handleNewConversation} className="w-full" disabled={createConversation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            New Conversation
          </Button>
        </div>
        <Separator />
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-2 space-y-2">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className={`p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                  conversationId === conv.id ? "bg-accent" : ""
                }`}
                onClick={() => setLocation(`/chat/${orgSlug}/${conv.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{conv.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    disabled={deleteConversation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {conversationId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card">
              <h2 className="text-lg font-semibold">{conversationData?.conversation?.title || "Chat"}</h2>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {localMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <Streamdown>{msg.content}</Streamdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {sendMessage.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-4 rounded-lg">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="max-w-3xl mx-auto space-y-2">
                {/* Agent Selection */}
                {agents && agents.length > 0 && (
                  <Select
                    value={selectedAgentId != null ? selectedAgentId.toString() : "default"}
                    onValueChange={(value) => {
                      if (!value || value === "default") {
                        setSelectedAgentId(null);
                        return;
                      }
                      setSelectedAgentId(parseInt(value, 10));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an agent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Assistant</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Type your message..."
                  disabled={sendMessage.isPending}
                  className="flex-1"
                />
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={transcribeAudio.isPending}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button onClick={handleSendMessage} disabled={!message.trim() || sendMessage.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Card>
              <CardHeader>
                <CardTitle>Select a conversation or create a new one</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleNewConversation} disabled={createConversation.isPending}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Conversation
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
