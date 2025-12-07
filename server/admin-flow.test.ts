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

describe("Admin Console Flow - Agent Creation", () => {
  const orgSlug = "test-org";
  let agentId: number;

  it("should access admin stats (admin role required)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.admin.stats();

    expect(stats).toHaveProperty("totalUsers");
    expect(stats).toHaveProperty("totalConversations");
    expect(stats).toHaveProperty("totalMessages");
    expect(typeof stats.totalUsers).toBe("number");
  });

  it("should navigate to Agents tab and list agents", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const agents = await caller.agents.list({ orgSlug });

    expect(Array.isArray(agents)).toBe(true);
  });

  it("should open Create Agent dialog and create new agent", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.agents.create({
      name: "Test Agent",
      description: "A test agent for admin flow",
      systemPrompt: "You are a helpful test assistant.",
      model: "gpt-4o",
      temperature: 7,
      enableRAG: true,
      enableSTT: false,
      enableWebSearch: false,
      orgSlug,
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    agentId = result.id;
  });

  it("should see the created agent in the list", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const agents = await caller.agents.list({ orgSlug });

    expect(agents.length).toBeGreaterThan(0);
    const createdAgent = agents.find((a) => a.id === agentId);
    expect(createdAgent).toBeDefined();
    expect(createdAgent?.name).toBe("Test Agent");
  });

  it("should get agent details", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const agent = await caller.agents.get({ id: agentId });

    expect(agent.id).toBe(agentId);
    expect(agent.name).toBe("Test Agent");
    expect(agent.systemPrompt).toBe("You are a helpful test assistant.");
    expect(agent.model).toBe("gpt-4o");
    expect(agent.temperature).toBe(7);
    expect(agent.enableRAG).toBe(1);
  });

  it("should cleanup - delete the test agent", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.agents.delete({ id: agentId });
    expect(result).toEqual({ success: true });
  });
});

describe("Admin Console Flow - Collection & Document Upload", () => {
  const orgSlug = "test-org";
  let collectionId: number;
  let documentId: number;

  it("should navigate to Collections tab and create collection", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.collections.create({
      name: "Test Collection",
      description: "A test collection for admin flow",
      orgSlug,
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    collectionId = result.id;
  });

  it("should see the created collection in the list", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const collections = await caller.collections.list({ orgSlug });

    expect(collections.length).toBeGreaterThan(0);
    const createdCollection = collections.find((c) => c.id === collectionId);
    expect(createdCollection).toBeDefined();
    expect(createdCollection?.name).toBe("Test Collection");
  });

  it("should navigate to Documents tab and upload document", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const testContent = "This is a test document for admin flow validation.";
    const base64Content = Buffer.from(testContent).toString("base64");

    const result = await caller.documents.upload({
      name: "test-admin-flow.txt",
      content: base64Content,
      mimeType: "text/plain",
      collectionId,
      orgSlug,
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    documentId = result.id;
  });

  it("should see the uploaded document in the list", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const documents = await caller.documents.list({ orgSlug });

    expect(documents.length).toBeGreaterThan(0);
    const uploadedDoc = documents.find((d) => d.id === documentId);
    expect(uploadedDoc).toBeDefined();
    expect(uploadedDoc?.name).toBe("test-admin-flow.txt");
  });

  it("should cleanup - delete document and collection", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await caller.documents.delete({ id: documentId });
    await caller.collections.delete({ id: collectionId });
  });
});
