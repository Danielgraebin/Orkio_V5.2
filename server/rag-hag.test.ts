/**
 * Tests for RAG (Retrieval-Augmented Generation) and HAG (Hierarchical Agent Graph)
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import * as rag from "./rag";

describe("RAG + HAG Integration Tests", () => {
  let testOrgSlug: string;
  let testCollectionId: number;
  let testDocumentId: number;
  let testAgentId: number;
  let testChildAgentId: number;

  beforeAll(async () => {
    testOrgSlug = `test-org-${Date.now()}`;
  });

  describe("PATCH 011.A: Document Upload + Processing", () => {
    it("should create a collection", async () => {
      testCollectionId = await db.createCollection({
        name: "Test Collection",
        description: "Collection for testing RAG",
        orgSlug: testOrgSlug,
      });
      expect(testCollectionId).toBeGreaterThan(0);
    });

    it("should create a document with pending status", async () => {
      testDocumentId = await db.createDocument({
        name: "test-doc.txt",
        mimeType: "text/plain",
        contentUrl: "https://example.com/test.txt",
        collectionId: testCollectionId,
        orgSlug: testOrgSlug,
        status: "pending",
      });
      expect(testDocumentId).toBeGreaterThan(0);
    });

    it("should process document and create embeddings", async () => {
      const testContent = "This is a test document about artificial intelligence and machine learning.";
      const base64Content = Buffer.from(testContent).toString('base64');
      
      await rag.processDocument(testDocumentId, base64Content, "text/plain");
      
      const embeddings = await db.getAllEmbeddings();
      const docEmbeddings = embeddings.filter(e => e.documentId === testDocumentId);
      
      expect(docEmbeddings.length).toBeGreaterThan(0);
      expect(docEmbeddings[0].content).toContain("artificial intelligence");
    });

    it("should update document status to completed", async () => {
      await db.updateDocument(testDocumentId, { status: "completed" });
      const doc = await db.getDocumentById(testDocumentId);
      expect(doc?.status).toBe("completed");
    });
  });

  describe("PATCH 011.B: Agent + RAG Integration", () => {
    it("should create an agent with RAG enabled", async () => {
      testAgentId = await db.createAgent({
        name: "RAG Test Agent",
        description: "Agent for testing RAG",
        systemPrompt: "You are a helpful assistant with access to documents.",
        model: "gpt-4o",
        temperature: 7,
        enableRAG: 1,
        enableSTT: 0,
        enableWebSearch: 0,
        orgSlug: testOrgSlug,
      });
      expect(testAgentId).toBeGreaterThan(0);
    });

    it("should link collection to agent", async () => {
      await db.linkAgentToCollection(testAgentId, testCollectionId);
      const collections = await db.getAgentCollections(testAgentId);
      expect(collections.length).toBe(1);
      expect(collections[0].collectionId).toBe(testCollectionId);
    });

    it("should search relevant chunks", async () => {
      const query = "What is artificial intelligence?";
      const results = await rag.searchRelevantChunks(query, [testCollectionId], 3);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].content).toBeTruthy();
    });

    it("should build RAG context", async () => {
      const chunks = [
        { content: "AI is machine intelligence", score: 0.9, documentId: testDocumentId },
        { content: "ML is a subset of AI", score: 0.8, documentId: testDocumentId },
      ];
      const context = rag.buildRAGContext(chunks);
      
      expect(context).toContain("AI is machine intelligence");
      expect(context).toContain("ML is a subset of AI");
      expect(context).toContain("relevance");
    });
  });

  describe("PATCH 012.A: Hierarchical Agent Graph (HAG)", () => {
    it("should create a child agent", async () => {
      testChildAgentId = await db.createAgent({
        name: "Child Agent",
        description: "Child agent for testing HAG",
        systemPrompt: "You are a specialized assistant.",
        model: "gpt-4o",
        temperature: 7,
        enableRAG: 0,
        enableSTT: 0,
        enableWebSearch: 0,
        orgSlug: testOrgSlug,
      });
      expect(testChildAgentId).toBeGreaterThan(0);
    });

    it("should link parent agent to child agent", async () => {
      await db.linkAgents(testAgentId, testChildAgentId);
      const linkedAgents = await db.getLinkedAgents(testAgentId);
      
      expect(linkedAgents.length).toBe(1);
      expect(linkedAgents[0].childAgentId).toBe(testChildAgentId);
    });

    it("should unlink all child agents", async () => {
      await db.unlinkAllChildAgents(testAgentId);
      const linkedAgents = await db.getLinkedAgents(testAgentId);
      expect(linkedAgents.length).toBe(0);
    });

    it("should re-link and verify", async () => {
      await db.linkAgents(testAgentId, testChildAgentId);
      const linkedAgents = await db.getLinkedAgents(testAgentId);
      expect(linkedAgents.length).toBe(1);
    });
  });

  describe("Cleanup", () => {
    it("should delete test data", async () => {
      // Delete agent links
      await db.unlinkAllChildAgents(testAgentId);
      
      // Delete agent collections
      await db.unlinkAllAgentCollections(testAgentId);
      
      // Delete agents
      await db.deleteAgent(testAgentId);
      await db.deleteAgent(testChildAgentId);
      
      // Delete document
      await db.deleteDocument(testDocumentId);
      
      // Delete collection
      await db.deleteCollection(testCollectionId);
      
      // Verify deletion
      const agent = await db.getAgentById(testAgentId);
      expect(agent).toBeNull();
    });
  });
});
