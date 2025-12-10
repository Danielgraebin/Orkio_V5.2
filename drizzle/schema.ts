import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Conversations table for chat platform.
 * Each conversation belongs to a user and an organization (multi-tenant).
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  orgSlug: varchar("orgSlug", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  agentId: int("agentId"), // Optional: which agent is used for this conversation
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table for chat platform.
 * Each message belongs to a conversation and has a role (user/assistant/system).
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Agents table for AI agents configuration.
 * Each agent has a system prompt, model, temperature, and enabled tools.
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  systemPrompt: text("systemPrompt").notNull(),
  model: varchar("model", { length: 64 }).default("gpt-4o").notNull(),
  temperature: int("temperature").default(7).notNull(), // 0-10 scale
  enableRAG: int("enableRAG").default(0).notNull(), // boolean as int
  enableSTT: int("enableSTT").default(0).notNull(),
  enableWebSearch: int("enableWebSearch").default(0).notNull(),
  orgSlug: varchar("orgSlug", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Collections table for document grouping.
 * Collections organize documents for RAG.
 */
export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  orgSlug: varchar("orgSlug", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

/**
 * Documents table for uploaded files.
 * Documents can be assigned to collections.
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  contentUrl: text("contentUrl"), // S3 URL
  collectionId: int("collectionId"),
  orgSlug: varchar("orgSlug", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "queued", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Embeddings table for vector search.
 * Stores document chunks with their embeddings.
 */
export const embeddings = mysqlTable("embeddings", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(), // JSON array of floats
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Embedding = typeof embeddings.$inferSelect;
export type InsertEmbedding = typeof embeddings.$inferInsert;

/**
 * Agent-Collection relationship.
 * Links agents to collections for RAG.
 */
export const agentCollections = mysqlTable("agent_collections", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  collectionId: int("collectionId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentCollection = typeof agentCollections.$inferSelect;
export type InsertAgentCollection = typeof agentCollections.$inferInsert;

/**
 * Agent-Agent relationship (HAG - Hierarchical Agent Graph).
 * Links parent agents to child agents for multi-agent orchestration.
 */
export const agentLinks = mysqlTable("agent_links", {
  id: int("id").autoincrement().primaryKey(),
  parentAgentId: int("parentAgentId").notNull(),
  childAgentId: int("childAgentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentLink = typeof agentLinks.$inferSelect;
export type InsertAgentLink = typeof agentLinks.$inferInsert;