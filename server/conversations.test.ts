import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1, orgSlug: string = "test-org"): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("conversations.create", () => {
  it("creates a new conversation for authenticated user", async () => {
    const { ctx } = createAuthContext(1, "test-org");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.conversations.create({
      title: "Test Conversation",
      orgSlug: "test-org",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    expect(result.id).toBeGreaterThan(0);
  });
});

describe("conversations.list", () => {
  it("lists conversations for authenticated user and org", async () => {
    const { ctx } = createAuthContext(1, "test-org");
    const caller = appRouter.createCaller(ctx);

    // Create a conversation first
    await caller.conversations.create({
      title: "Test Conversation for List",
      orgSlug: "test-org",
    });

    const result = await caller.conversations.list({ orgSlug: "test-org" });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("title");
    expect(result[0]).toHaveProperty("userId");
    expect(result[0]).toHaveProperty("orgSlug");
  });
});

describe("conversations.get", () => {
  it("gets a conversation with messages", async () => {
    const { ctx } = createAuthContext(1, "test-org");
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const created = await caller.conversations.create({
      title: "Test Conversation for Get",
      orgSlug: "test-org",
    });

    const result = await caller.conversations.get({
      id: created.id,
      orgSlug: "test-org",
    });

    expect(result).toHaveProperty("conversation");
    expect(result).toHaveProperty("messages");
    expect(result.conversation.id).toBe(created.id);
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it("throws error when accessing conversation from different org", async () => {
    const { ctx } = createAuthContext(1, "test-org");
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const created = await caller.conversations.create({
      title: "Test Conversation",
      orgSlug: "test-org",
    });

    // Try to access with different org
    await expect(
      caller.conversations.get({
        id: created.id,
        orgSlug: "different-org",
      })
    ).rejects.toThrow("Conversation not found or access denied");
  });
});

describe("conversations.delete", () => {
  it("deletes a conversation", async () => {
    const { ctx } = createAuthContext(1, "test-org");
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const created = await caller.conversations.create({
      title: "Test Conversation for Delete",
      orgSlug: "test-org",
    });

    const result = await caller.conversations.delete({
      id: created.id,
      orgSlug: "test-org",
    });

    expect(result).toEqual({ success: true });

    // Verify it's deleted
    await expect(
      caller.conversations.get({
        id: created.id,
        orgSlug: "test-org",
      })
    ).rejects.toThrow("Conversation not found or access denied");
  });

  it("throws error when deleting conversation from different org", async () => {
    const { ctx } = createAuthContext(1, "test-org");
    const caller = appRouter.createCaller(ctx);

    // Create a conversation
    const created = await caller.conversations.create({
      title: "Test Conversation",
      orgSlug: "test-org",
    });

    // Try to delete with different org
    await expect(
      caller.conversations.delete({
        id: created.id,
        orgSlug: "different-org",
      })
    ).rejects.toThrow("Conversation not found or access denied");
  });
});
