import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
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

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
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

describe("admin.stats", () => {
  it("returns stats for admin user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.stats();

    expect(result).toHaveProperty("totalUsers");
    expect(result).toHaveProperty("totalConversations");
    expect(result).toHaveProperty("totalMessages");
    expect(typeof result.totalUsers).toBe("number");
  });

  it("throws error for non-admin user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.stats()).rejects.toThrow("Admin access required");
  });
});

describe("admin.users", () => {
  it("returns all users for admin", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.users();

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("email");
      expect(result[0]).toHaveProperty("role");
    }
  });

  it("throws error for non-admin user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.users()).rejects.toThrow("Admin access required");
  });
});

describe("admin.allConversations", () => {
  it("returns all conversations for admin", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.allConversations();

    expect(Array.isArray(result)).toBe(true);
  });

  it("throws error for non-admin user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.allConversations()).rejects.toThrow("Admin access required");
  });
});

describe("admin.updateUserRole", () => {
  it("updates user role for admin", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create a test user first (using the regular user context)
    const { ctx: userCtx } = createUserContext();
    const userId = userCtx.user.id;

    const result = await caller.admin.updateUserRole({
      userId,
      role: "admin",
    });

    expect(result).toEqual({ success: true });
  });

  it("throws error for non-admin user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.updateUserRole({
        userId: 1,
        role: "admin",
      })
    ).rejects.toThrow("Admin access required");
  });
});
