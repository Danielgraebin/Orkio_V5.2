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
import { storagePut } from "./_core/storage";
import { getRagQueue } from "./ragQueue";
import { logger } from "./_core/logger";
import { ENV } from "./_core/env";

// Timeout wrapper for long-running operations
function withTimeout<T>(promise: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${tag} timeout after ${ms}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

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
        logger.info("chat.stream.user_message", { conversationId: input.conversationId, agentId: conversation.agentId, messageLength: input.message.length });

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
            try {
              const agentCollections = await db.getAgentCollections(agent.id);
              let collectionIds = agentCollections.map(c => c.collectionId);
              
              // Also include conversation collection if it exists
              const conversationCollectionName = `conversation-${conversation.id}`;
              const allCollections = await db.getCollectionsByOrg(conversation.orgSlug);
              const conversationCollection = allCollections.find((c: { name: string }) => c.name === conversationCollectionName);
              if (conversationCollection) {
                collectionIds.push(conversationCollection.id);
              }
              
              console.log(`[Chat] Agent ${agent.id} has ${collectionIds.length} collections for RAG (including conversation)`);
              
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
            } catch (error) {
              logger.error("chat.rag.failed", {
                agentId: agent.id,
                conversationId: input.conversationId,
                error: error instanceof Error ? error.message : String(error),
              });
              console.error(`[Chat] RAG failed for agent ${agent.id}:`, error);
              // Continue without RAG context
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
        logger.info("chat.stream.assistant_response", { conversationId: input.conversationId, agentId: conversation.agentId, responseLength: assistantMessage.length, hadRAG: !!ragContext });

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

    // Set agent for conversation
    setAgent: protectedProcedure
      .input(z.object({ id: z.number(), agentId: z.number().nullable(), orgSlug: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.id);
        if (!conversation || conversation.userId !== ctx.user.id || conversation.orgSlug !== input.orgSlug) {
          throw new Error("Conversation not found or access denied");
        }
        await db.updateConversation(input.id, { agentId: input.agentId ?? undefined });
        return { ok: true };
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
        // Find or create KB collection for this agent
        const name = `agent-${agent.id}`;
        const collections = await db.getCollectionsByOrg(agent.orgSlug as string);
        const kb = collections.find(c => c.name === name);
        return { ...agent, kbCollectionId: kb?.id ?? null };
      }),

    // Ensure KB collection exists for agent (create if needed)
    ensureKb: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const agent = await db.getAgentById(input.id);
        if (!agent) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
        }
        const name = `agent-${agent.id}`;
        const collections = await db.getCollectionsByOrg(agent.orgSlug as string);
        let kb = collections.find(c => c.name === name);
        if (!kb) {
          const kbId = await db.createCollection({
            name,
            description: `Default KB for agent ${agent.id}`,
            orgSlug: agent.orgSlug as string,
          });
          kb = await db.getCollectionById(kbId);
          logger.info("agents.ensureKb.created", { agentId: agent.id, collectionId: kbId });
        }
        return { kbCollectionId: kb!.id };
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
        name: z.string().min(1),
        content: z.string().optional(),
        base64: z.string().optional(),
        mimeType: z.string().optional(),
        mime: z.string().optional(),
        collectionId: z.number().optional(),
        conversationId: z.number().optional(),
        agentId: z.number().optional(),  // NEW: when coming from AgentsManager
        orgSlug: z.string().min(1)
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Field tolerance: accept both naming conventions
          const mimeType = input.mimeType ?? input.mime ?? "application/octet-stream";
          const base64Content = input.content ?? input.base64;
          if (!base64Content) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing file content (content or base64 field required)' });
          }
          // Validate file size (base64 content)
          const fileSizeBytes = Buffer.from(base64Content, 'base64').length;
          const fileSizeMB = fileSizeBytes / (1024 * 1024);
          if (fileSizeMB > ENV.uploadMaxMB) {
            throw new TRPCError({ 
              code: 'PAYLOAD_TOO_LARGE', 
              message: `File size (${fileSizeMB.toFixed(2)} MB) exceeds maximum allowed size of ${ENV.uploadMaxMB} MB.` 
            });
          }
          logger.info("documents.upload.start", { name: input.name, sizeMB: fileSizeMB.toFixed(2), mimeType });

          // Collection target: explicit OR from agentId OR from conversation
          let collectionId = input.collectionId;
          
          // Priority 1: agentId → ensure KB agent-{id}
          if (!collectionId && input.agentId) {
            const name = `agent-${input.agentId}`;
            const existing = (await db.getCollectionsByOrg(input.orgSlug)).find(c => c.name === name);
            collectionId = existing?.id ?? await db.createCollection({
              name, description: `Default KB for agent ${input.agentId}`, orgSlug: input.orgSlug
            });
          }
          
          // Priority 2: conversationId → ensure conversation-{id}
          if (!collectionId && input.conversationId) {
            const name = `conversation-${input.conversationId}`;
            const existing = (await db.getCollectionsByOrg(input.orgSlug)).find(c => c.name === name);
            collectionId = existing?.id ?? await db.createCollection({
              name, description: `Documents for conversation ${input.conversationId}`, orgSlug: input.orgSlug
            });
          }

          // Limit per collection
          if (collectionId) {
            const existingDocs = await db.getDocumentsByCollection(collectionId);
            if (existingDocs.length >= ENV.maxFilesPerCollection) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: `Maximum ${ENV.maxFilesPerCollection} files per collection.` });
            }
          }

          // Storage (keep original file URL) with timeout
          let url: string;
          try {
            const result = await withTimeout(
              storagePut(
                `orgs/${input.orgSlug}/uploads/${Date.now()}-${input.name}`,
                Buffer.from(base64Content, 'base64'),
                mimeType
              ),
              20000,
              "storagePut"
            );
            url = result.url;
          } catch (storageError) {
            logger.error("documents.upload.storage_failed", { 
              name: input.name, 
              error: storageError instanceof Error ? storageError.message : String(storageError) 
            });
            throw new TRPCError({ 
              code: 'INTERNAL_SERVER_ERROR', 
              message: 'Failed to upload file to storage. Please try again.' 
            });
          }

        // Initial status (short-circuit or queue/inline)
        const initialStatus = ENV.debugUploadShortCircuit ? "completed" : (ENV.ragIngestMode === 'queue' ? "queued" : "processing");
        const documentId = await db.createDocument({
          name: input.name,
          mimeType,
          contentUrl: url,
          collectionId: collectionId ?? undefined,
          orgSlug: input.orgSlug,
          status: initialStatus
        });
        
        // Short-circuit mode: skip RAG/embeddings for diagnostics
        if (ENV.debugUploadShortCircuit) {
          logger.info("documents.upload.completed_short_circuit", { documentId, url, agentId: input.agentId });
          return { id: documentId, status: "completed" as const, url };
        }

          // INGEST: queue with retries and backoff (if queue mode and queue available)
          if (ENV.ragIngestMode === 'queue') {
            const queue = getRagQueue();
            if (queue) {
              try {
                await queue.add(
                  'ingest',
                  { documentId, content: input.content, mimeType: input.mimeType },
                  {
                    attempts: 5,
                    backoff: { type: 'exponential', delay: 2000 },
                    removeOnComplete: true,
                    removeOnFail: false
                  }
                );
                logger.info("documents.upload.queued", { documentId, collectionId });
              } catch (error) {
                // Queue failed, fall back to inline
                logger.warn("documents.upload.queue_failed_fallback_inline", { documentId, error: error instanceof Error ? error.message : String(error) });
                try {
                  await withTimeout(
                    rag.processDocument(documentId, base64Content, mimeType),
                    30000,
                    "ingest"
                  );
                  await db.updateDocument(documentId, { status: "completed" });
                  logger.info("documents.upload.completed", { documentId, collectionId, mode: "inline_fallback" });
                } catch (inlineError: any) {
                  await db.updateDocument(documentId, { status: "failed" });
                  logger.error("documents.upload.failed", { documentId, error: inlineError?.message || String(inlineError) });
                }
              }
            } else {
              // Queue not available, use inline
              logger.info("documents.upload.inline_mode", { documentId, reason: "queue_not_available" });
              try {
                await withTimeout(
                  rag.processDocument(documentId, base64Content, mimeType),
                  30000,
                  "ingest"
                );
                await db.updateDocument(documentId, { status: "completed" });
                logger.info("documents.upload.completed", { documentId, collectionId, mode: "inline" });
              } catch (error: any) {
                await db.updateDocument(documentId, { status: "failed" });
                logger.error("documents.upload.failed", { documentId, error: error?.message || String(error) });
              }
            }
          } else {
            // Inline mode
            try {
              await withTimeout(
                rag.processDocument(documentId, base64Content, mimeType),
                30000,
                "ingest"
              );
              await db.updateDocument(documentId, { status: "completed" });
              logger.info("documents.upload.completed", { documentId, collectionId, mode: "inline" });
            } catch (error: any) {
              await db.updateDocument(documentId, { status: "failed" });
              logger.error("documents.upload.failed", { documentId, error: error?.message || String(error) });
            }
          }

          return { id: documentId, status: "processing" };
        } catch (error) {
          // Catch any unexpected errors and return proper TRPCError
          if (error instanceof TRPCError) {
            throw error;
          }
          logger.error("documents.upload.unexpected_error", { 
            name: input.name, 
            error: error instanceof Error ? error.message : String(error) 
          });
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: error instanceof Error ? error.message : 'Upload failed. Please try again.' 
          });
        }
      }),

    // Delete document
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDocument(input.id);
        return { success: true };
      }),

    // Get document status
    status: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const d = await db.getDocumentById(input.id);
        if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        return { id: d.id, status: d.status };
      }),

    // List documents by collection
    listByCollection: protectedProcedure
      .input(z.object({ collectionId: z.number() }))
      .query(async ({ input }) => db.getDocumentsByCollection(input.collectionId)),

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
