import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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

describe("AT-07: V4.5 Integration Tests", () => {
  const orgSlug = "test-org";
  let agentId: number;
  let collectionId: number;
  let documentId: number;

  describe("Agents Module", () => {
    it("should create a new agent", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.agents.create({
        name: "Test Agent",
        description: "A test agent for AT-07",
        systemPrompt: "You are a helpful test assistant.",
        model: "gpt-4o",
        temperature: 7,
        enableRAG: true,
        enableSTT: true,
        enableWebSearch: false,
        orgSlug,
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      agentId = result.id;
    });

    it("should list agents for organization", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const agents = await caller.agents.list({ orgSlug });

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toHaveProperty("name");
      expect(agents[0]).toHaveProperty("systemPrompt");
    });

    it("should get agent by ID", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const agent = await caller.agents.get({ id: agentId });

      expect(agent).toHaveProperty("id", agentId);
      expect(agent).toHaveProperty("name", "Test Agent");
      expect(agent.enableRAG).toBe(1);
      expect(agent.enableSTT).toBe(1);
    });

    it("should update agent", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.agents.update({
        id: agentId,
        name: "Updated Test Agent",
        temperature: 5,
      });

      expect(result).toEqual({ success: true });

      const agent = await caller.agents.get({ id: agentId });
      expect(agent.name).toBe("Updated Test Agent");
      expect(agent.temperature).toBe(5);
    });
  });

  describe("Collections Module", () => {
    it("should create a new collection", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.collections.create({
        name: "Test Collection",
        description: "A test collection for AT-07",
        orgSlug,
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      collectionId = result.id;
    });

    it("should list collections for organization", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const collections = await caller.collections.list({ orgSlug });

      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
      expect(collections[0]).toHaveProperty("name");
    });

    it("should get collection by ID", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.collections.get({ id: collectionId });

      expect(result).toHaveProperty("collection");
      expect(result).toHaveProperty("documents");
      expect(result.collection.id).toBe(collectionId);
      expect(result.collection.name).toBe("Test Collection");
    });
  });

  describe("Documents Module", () => {
    it("should upload and process a document", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const testContent = "This is a test document for RAG. It contains important information about testing.";
      const base64Content = Buffer.from(testContent).toString("base64");

      const result = await caller.documents.upload({
        name: "test-document.txt",
        content: base64Content,
        mimeType: "text/plain",
        collectionId,
        orgSlug,
      });

      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      documentId = result.id;
    });

    it("should list documents for organization", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const documents = await caller.documents.list({ orgSlug });

      expect(Array.isArray(documents)).toBe(true);
      expect(documents.length).toBeGreaterThan(0);
      expect(documents[0]).toHaveProperty("name");
      expect(documents[0]).toHaveProperty("status");
    });

    it("should get document by ID", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const document = await caller.documents.get({ id: documentId });

      expect(document).toHaveProperty("id", documentId);
      expect(document).toHaveProperty("name", "test-document.txt");
      expect(document.status).toBe("completed");
    });

    it("should search documents using RAG", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const results = await caller.documents.search({
        query: "testing information",
        collectionIds: [collectionId],
        topK: 3,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("content");
      expect(results[0]).toHaveProperty("score");
      expect(results[0]).toHaveProperty("documentId");
    });
  });

  describe("Agent-Collection Integration", () => {
    it("should link agent to collection", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.agents.linkCollection({
        agentId,
        collectionId,
      });

      expect(result).toEqual({ success: true });
    });

    it("should get agent's collections", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const collections = await caller.agents.getCollections({ agentId });

      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
      expect(collections[0]).toHaveProperty("collectionId", collectionId);
    });

    it("should unlink agent from collection", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.agents.unlinkCollection({
        agentId,
        collectionId,
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("Cleanup", () => {
    it("should delete document", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.documents.delete({ id: documentId });
      expect(result).toEqual({ success: true });
    });

    it("should delete collection", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.collections.delete({ id: collectionId });
      expect(result).toEqual({ success: true });
    });

    it("should delete agent", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.agents.delete({ id: agentId });
      expect(result).toEqual({ success: true });
    });
  });
});
