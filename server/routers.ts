import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import * as rag from "./rag";
import * as stt from "./stt";
import { storagePut } from "./storage";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Chat router
  chat: router({
    // Stream chat messages with LLM
    stream: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string(),
        orgSlug: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify conversation belongs to user and org
        const conversation = await db.getConversationById(input.conversationId);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.orgSlug !== input.orgSlug) {
          throw new Error("Conversation not found or access denied");
        }

        // Save user message
        await db.createMessage({
          conversationId: input.conversationId,
          role: "user",
          content: input.message,
        });

        // Get conversation history
        const history = await db.getMessagesByConversation(input.conversationId);
        const messages = history.map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

        // Check if conversation has an agent with RAG enabled
        let ragContext = "";
        if (conversation.agentId) {
          const agent = await db.getAgentById(conversation.agentId);
          console.log(`[Chat] Agent ${agent?.id} (${agent?.name}) - RAG enabled: ${agent?.enableRAG === 1}`);
          
          if (agent && agent.enableRAG === 1) {
            // Get agent's collections
            const agentCollections = await db.getAgentCollections(agent.id);
            const collectionIds = agentCollections.map(c => c.collectionId);
            console.log(`[Chat] Agent ${agent.id} has ${collectionIds.length} collections: ${collectionIds.join(", ")}`);
            
            if (collectionIds.length > 0) {
              // Search for relevant chunks
              const relevantChunks = await rag.searchRelevantChunks(input.message, collectionIds, 5);
              console.log(`[Chat] RAG found ${relevantChunks.length} relevant chunks for agent ${agent.id}, conversation ${input.conversationId}`);
              
              if (relevantChunks.length > 0) {
                ragContext = rag.buildRAGContext(relevantChunks);
                console.log(`[Chat] RAG context built (${ragContext.length} chars)`);
              }
            } else {
              console.log(`[Chat] Agent ${agent.id} has RAG ON but no collections linked`);
            }
          }
        }

        // Check if agent has linked agents (HAG)
        if (conversation.agentId) {
          const agent = await db.getAgentById(conversation.agentId);
          if (agent) {
            const linkedAgents = await db.getLinkedAgents(agent.id);
            console.log(`[Chat] Agent ${agent.id} has ${linkedAgents.length} linked agents`);
          if (linkedAgents.length > 0) {
            // Simple HAG implementation: forward to first linked agent
            const childAgentId = linkedAgents[0].childAgentId;
            const childAgent = await db.getAgentById(childAgentId);
            
            if (childAgent) {
              // Build child agent context
              let childSystemContent = childAgent.systemPrompt || "You are a helpful assistant.";
              
              // If child agent has RAG, apply it
              if (childAgent.enableRAG === 1) {
                const childCollections = await db.getAgentCollections(childAgent.id);
                const childCollectionIds = childCollections.map(c => c.collectionId);
                if (childCollectionIds.length > 0) {
                  const childRelevantChunks = await rag.searchRelevantChunks(input.message, childCollectionIds, 5);
                  if (childRelevantChunks.length > 0) {
                    const childRagContext = rag.buildRAGContext(childRelevantChunks);
                    childSystemContent = `${childSystemContent}\n\n${childRagContext}`;
                  }
                }
              }
              
              // Prepend child agent system prompt
              console.log(`[Chat] Delegating to child agent ${childAgent.id} (${childAgent.name})`);
              messages.unshift({
                role: "system",
                content: `[Delegated to agent: ${childAgent.name}]\n\n${childSystemContent}`,
              });
            }
          } else {
            // No linked agents, use parent agent's system prompt
            if (agent && agent.systemPrompt) {
              let systemContent = agent.systemPrompt;
              if (ragContext) {
                systemContent = `${agent.systemPrompt}\n\n${ragContext}`;
              }
              messages.unshift({
                role: "system",
                content: systemContent,
              });
            }
          }
          }
        }

        // Call LLM
        const response = await invokeLLM({ messages });
        const content = response.choices[0]?.message?.content;
        const assistantMessage = typeof content === 'string' 
          ? content 
          : Array.isArray(content) 
            ? content.map(c => 'text' in c ? c.text : '').join('') 
            : "Sorry, I couldn't generate a response.";

        // Save assistant message
        await db.createMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: assistantMessage,
        });

        return { content: assistantMessage };
      }),
  }),

  // Conversation router
  conversations: router({
    // List conversations for current user and org
    list: protectedProcedure
      .input(z.object({ orgSlug: z.string() }))
      .query(async ({ ctx, input }) => {
        return db.getConversationsByUser(ctx.user.id, input.orgSlug);
      }),

    // Get single conversation with messages
    get: protectedProcedure
      .input(z.object({ id: z.number(), orgSlug: z.string() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.orgSlug !== input.orgSlug) {
          throw new Error("Conversation not found or access denied");
        }
        const messages = await db.getMessagesByConversation(input.id);
        return { conversation, messages };
      }),

    // Create new conversation
    create: protectedProcedure
      .input(z.object({ title: z.string(), orgSlug: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createConversation({
          userId: ctx.user.id,
          orgSlug: input.orgSlug,
          title: input.title,
        });
        return { id };
      }),

    // Delete conversation
    delete: protectedProcedure
      .input(z.object({ id: z.number(), orgSlug: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.orgSlug !== input.orgSlug) {
          throw new Error("Conversation not found or access denied");
        }
        await db.deleteConversation(input.id);
        return { success: true };
      }),
  }),

  // Admin router
  admin: router({
    // Get dashboard stats
    stats: adminProcedure.query(async () => {
      return db.getStats();
    }),

    // Get all users
    users: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),

    // Update user role
    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    // Get all conversations (across all orgs)
    allConversations: adminProcedure.query(async () => {
      return db.getAllConversations();
    }),

    // Get conversation with messages (admin can access any)
    getConversation: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        }
        const messages = await db.getMessagesByConversation(input.id);
        return { conversation, messages };
      }),
  }),

  // Agents router
  agents: router({
    // List agents for current org
    list: protectedProcedure
      .input(z.object({ orgSlug: z.string() }))
      .query(async ({ input }) => {
        const agents = await db.getAgentsByOrg(input.orgSlug);
        // Add collectionIds and linkedAgentIds to each agent
        const agentsWithRelations = await Promise.all(
          agents.map(async (agent) => {
            const collections = await db.getAgentCollections(agent.id);
            const linkedAgents = await db.getLinkedAgents(agent.id);
            return {
              ...agent,
              collectionIds: collections.map((c) => c.collectionId),
              linkedAgentIds: linkedAgents.map((l) => l.childAgentId),
            };
          })
        );
        return agentsWithRelations;
      }),

    // Get single agent
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
        }
        return agent;
      }),

    // Create new agent
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        systemPrompt: z.string(),
        model: z.string().default("gpt-4o"),
        temperature: z.number().min(0).max(10).default(7),
        enableRAG: z.boolean().default(false),
        enableSTT: z.boolean().default(false),
        enableWebSearch: z.boolean().default(false),
        collectionIds: z.array(z.number()).optional(),
        linkedAgentIds: z.array(z.number()).optional(),
        orgSlug: z.string(),
      }))
      .mutation(async ({ input }) => {
        const agentId = await db.createAgent({
          ...input,
          enableRAG: input.enableRAG ? 1 : 0,
          enableSTT: input.enableSTT ? 1 : 0,
          enableWebSearch: input.enableWebSearch ? 1 : 0,
        });

        // Link collections to agent
        if (input.collectionIds && input.collectionIds.length > 0) {
          for (const collectionId of input.collectionIds) {
            await db.linkAgentToCollection(agentId, collectionId);
          }
        }

        // Link child agents (HAG)
        if (input.linkedAgentIds && input.linkedAgentIds.length > 0) {
          for (const childAgentId of input.linkedAgentIds) {
            await db.linkAgents(agentId, childAgentId);
          }
        }

        return { id: agentId };
      }),

    // Update agent
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        systemPrompt: z.string().optional(),
        model: z.string().optional(),
        temperature: z.number().min(0).max(10).optional(),
        enableRAG: z.boolean().optional(),
        enableSTT: z.boolean().optional(),
        enableWebSearch: z.boolean().optional(),
        collectionIds: z.array(z.number()).optional(),
        linkedAgentIds: z.array(z.number()).optional(),
        orgSlug: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, collectionIds, linkedAgentIds, ...updates } = input;
        const dbUpdates: any = { ...updates };
        if (updates.enableRAG !== undefined) dbUpdates.enableRAG = updates.enableRAG ? 1 : 0;
        if (updates.enableSTT !== undefined) dbUpdates.enableSTT = updates.enableSTT ? 1 : 0;
        if (updates.enableWebSearch !== undefined) dbUpdates.enableWebSearch = updates.enableWebSearch ? 1 : 0;
        await db.updateAgent(id, dbUpdates);

        // Update collections linkage
        if (collectionIds !== undefined) {
          // Remove all existing links
          await db.unlinkAllAgentCollections(id);
          // Add new links
          for (const collectionId of collectionIds) {
            await db.linkAgentToCollection(id, collectionId);
          }
        }

        // Update linked agents (HAG)
        if (linkedAgentIds !== undefined) {
          // Remove all existing links
          await db.unlinkAllChildAgents(id);
          // Add new links
          for (const childAgentId of linkedAgentIds) {
            await db.linkAgents(id, childAgentId);
          }
        }

        return { success: true };
      }),

    // Delete agent
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAgent(input.id);
        return { success: true };
      }),

    // Link agent to collection
    linkCollection: protectedProcedure
      .input(z.object({ agentId: z.number(), collectionId: z.number() }))
      .mutation(async ({ input }) => {
        await db.linkAgentToCollection(input.agentId, input.collectionId);
        return { success: true };
      }),

    // Unlink agent from collection
    unlinkCollection: protectedProcedure
      .input(z.object({ agentId: z.number(), collectionId: z.number() }))
      .mutation(async ({ input }) => {
        await db.unlinkAgentFromCollection(input.agentId, input.collectionId);
        return { success: true };
      }),

    // Get agent's collections
    getCollections: protectedProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        return db.getAgentCollections(input.agentId);
      }),
  }),

  // Collections router
  collections: router({
    // List collections for current org
    list: protectedProcedure
      .input(z.object({ orgSlug: z.string() }))
      .query(async ({ input }) => {
        return db.getCollectionsByOrg(input.orgSlug);
      }),

    // Get single collection with documents
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const collection = await db.getCollectionById(input.id);
        if (!collection) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection not found' });
        }
        const documents = await db.getDocumentsByCollection(input.id);
        return { collection, documents };
      }),

    // Create new collection
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        orgSlug: z.string(),
      }))
      .mutation(async ({ input }) => {
        const collectionId = await db.createCollection(input);
        return { id: collectionId };
      }),

    // Update collection
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateCollection(id, updates);
        return { success: true };
      }),

    // Delete collection
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCollection(input.id);
        return { success: true };
      }),
  }),

  // Documents router
  documents: router({
    // List documents for current org
    list: protectedProcedure
      .input(z.object({ orgSlug: z.string() }))
      .query(async ({ input }) => {
        return db.getDocumentsByOrg(input.orgSlug);
      }),

    // Get single document
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const document = await db.getDocumentById(input.id);
        if (!document) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        }
        return document;
      }),

    // Upload and process document
    upload: protectedProcedure
      .input(z.object({
        name: z.string(),
        content: z.string(), // Base64 or text content
        mimeType: z.string(),
        collectionId: z.number().optional(),
        orgSlug: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Check file limit per collection (20 files max)
        if (input.collectionId) {
          const existingDocs = await db.getDocumentsByCollection(input.collectionId);
          if (existingDocs.length >= 20) {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: 'Maximum 20 files per collection. Please delete some files or create a new collection.' 
            });
          }
        }
        
        // Upload to S3
        const fileKey = `${input.orgSlug}/documents/${Date.now()}-${input.name}`;
        const { url } = await storagePut(fileKey, Buffer.from(input.content, 'base64'), input.mimeType);

        // Create document record
        const documentId = await db.createDocument({
          name: input.name,
          mimeType: input.mimeType,
          contentUrl: url,
          collectionId: input.collectionId,
          orgSlug: input.orgSlug,
          status: "processing",
        });

        // Process document asynchronously (in background)
        // For now, we'll process it synchronously
        try {
          await rag.processDocument(documentId, input.content, input.mimeType);
          await db.updateDocument(documentId, { status: "completed" });
          return { id: documentId, status: "completed" as const };
        } catch (error) {
          console.error(`Document processing failed for ID ${documentId}:`, error);
          await db.updateDocument(documentId, { status: "failed" });
          // Don't throw - return success with failed status so UI can show the document
          return { 
            id: documentId, 
            status: "failed" as const,
            error: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }),

    // Delete document
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDocument(input.id);
        return { success: true };
      }),

    // Search documents using RAG
    search: protectedProcedure
      .input(z.object({
        query: z.string(),
        collectionIds: z.array(z.number()),
        topK: z.number().default(5),
      }))
      .query(async ({ input }) => {
        return rag.searchRelevantChunks(input.query, input.collectionIds, input.topK);
      }),
  }),

  // STT (Speech-to-Text) router
  stt: router({
    // Transcribe audio to text
    transcribe: protectedProcedure
      .input(z.object({
        audioData: z.string(), // Base64 encoded audio
        mimeType: z.string(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const text = await stt.transcribeAudioData(input.audioData, input.mimeType, input.language);
        return { text };
      }),
  }),
});

export type AppRouter = typeof appRouter;
