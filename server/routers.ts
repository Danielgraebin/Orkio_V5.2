import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

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
});

export type AppRouter = typeof appRouter;
