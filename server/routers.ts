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
        return db.getAgentsByOrg(input.orgSlug);
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
        orgSlug: z.string(),
      }))
      .mutation(async ({ input }) => {
        const agentId = await db.createAgent({
          ...input,
          enableRAG: input.enableRAG ? 1 : 0,
          enableSTT: input.enableSTT ? 1 : 0,
          enableWebSearch: input.enableWebSearch ? 1 : 0,
        });
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
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const dbUpdates: any = { ...updates };
        if (updates.enableRAG !== undefined) dbUpdates.enableRAG = updates.enableRAG ? 1 : 0;
        if (updates.enableSTT !== undefined) dbUpdates.enableSTT = updates.enableSTT ? 1 : 0;
        if (updates.enableWebSearch !== undefined) dbUpdates.enableWebSearch = updates.enableWebSearch ? 1 : 0;
        await db.updateAgent(id, dbUpdates);
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
          await rag.processDocument(documentId, input.content);
          await db.updateDocument(documentId, { status: "completed" });
        } catch (error) {
          await db.updateDocument(documentId, { status: "failed" });
          throw error;
        }

        return { id: documentId };
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
