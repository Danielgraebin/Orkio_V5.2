import { eq, and, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, conversations, InsertConversation, messages, InsertMessage,
  agents, InsertAgent, collections, InsertCollection, documents, InsertDocument,
  embeddings, InsertEmbedding, agentCollections, InsertAgentCollection,
  agentLinks, InsertAgentLink
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Conversation queries
export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(conversations).values(data);
  // Return the conversation to get the ID
  const result = await db.select().from(conversations)
    .where(and(
      eq(conversations.userId, data.userId),
      eq(conversations.orgSlug, data.orgSlug),
      eq(conversations.title, data.title)
    ))
    .orderBy(conversations.createdAt)
    .limit(1);
  return result[0]?.id ?? 0;
}

export async function getConversationsByUser(userId: number, orgSlug: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.orgSlug, orgSlug)))
    .orderBy(conversations.updatedAt);
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(conversations).where(eq(conversations.id, id));
}

// Message queries
export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(messages).values(data);
  // Return the message to get the ID
  const result = await db.select().from(messages)
    .where(eq(messages.conversationId, data.conversationId))
    .orderBy(messages.createdAt)
    .limit(1);
  return result[0]?.id ?? 0;
}

export async function getMessagesByConversation(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

// Admin queries
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(users).orderBy(users.createdAt);
}

export async function getAllConversations() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(conversations).orderBy(conversations.updatedAt);
}

export async function getStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalConversations: 0, totalMessages: 0 };
  
  const [usersCount] = await db.select({ value: count() }).from(users);
  const [conversationsCount] = await db.select({ value: count() }).from(conversations);
  const [messagesCount] = await db.select({ value: count() }).from(messages);
  
  return {
    totalUsers: Number(usersCount?.value ?? 0),
    totalConversations: Number(conversationsCount?.value ?? 0),
    totalMessages: Number(messagesCount?.value ?? 0),
  };
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ==================== AGENTS ====================

export async function createAgent(agent: InsertAgent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(agents).values(agent);
  return result[0].insertId;
}

export async function getAgentsByOrg(orgSlug: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(agents).where(eq(agents.orgSlug, orgSlug)).orderBy(agents.createdAt);
}

export async function getAgentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return result[0];
}

export async function updateAgent(id: number, updates: Partial<InsertAgent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(agents).set(updates).where(eq(agents.id, id));
}

export async function deleteAgent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(agents).where(eq(agents.id, id));
}

export async function linkAgentToCollection(agentId: number, collectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(agentCollections).values({ agentId, collectionId });
}

export async function unlinkAgentFromCollection(agentId: number, collectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(agentCollections)
    .where(and(eq(agentCollections.agentId, agentId), eq(agentCollections.collectionId, collectionId)));
}

export async function unlinkAllAgentCollections(agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(agentCollections)
    .where(eq(agentCollections.agentId, agentId));
}

export async function getAgentCollections(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(agentCollections)
    .where(eq(agentCollections.agentId, agentId));
  
  return result;
}

// ==================== AGENT LINKS (HAG) ====================

export async function linkAgents(parentAgentId: number, childAgentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(agentLinks).values({ parentAgentId, childAgentId });
}

export async function unlinkAgents(parentAgentId: number, childAgentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(agentLinks)
    .where(and(eq(agentLinks.parentAgentId, parentAgentId), eq(agentLinks.childAgentId, childAgentId)));
}

export async function unlinkAllChildAgents(parentAgentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(agentLinks)
    .where(eq(agentLinks.parentAgentId, parentAgentId));
}

export async function getLinkedAgents(parentAgentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(agentLinks)
    .where(eq(agentLinks.parentAgentId, parentAgentId));
  
  return result;
}

// ==================== COLLECTIONS ====================

export async function createCollection(collection: InsertCollection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(collections).values(collection);
  return result[0].insertId;
}

export async function getCollectionsByOrg(orgSlug: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(collections).where(eq(collections.orgSlug, orgSlug)).orderBy(collections.createdAt);
}

export async function getCollectionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  return result[0];
}

export async function updateCollection(id: number, updates: Partial<InsertCollection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(collections).set(updates).where(eq(collections.id, id));
}

export async function deleteCollection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(collections).where(eq(collections.id, id));
}

// ==================== DOCUMENTS ====================

export async function createDocument(document: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(documents).values(document);
  return result[0].insertId;
}

export async function getDocumentsByCollection(collectionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(documents).where(eq(documents.collectionId, collectionId)).orderBy(documents.createdAt);
}

export async function getDocumentsByOrg(orgSlug: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(documents).where(eq(documents.orgSlug, orgSlug)).orderBy(documents.createdAt);
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result[0];
}

export async function updateDocument(id: number, updates: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(documents).set(updates).where(eq(documents.id, id));
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete embeddings first
  await db.delete(embeddings).where(eq(embeddings.documentId, id));
  // Then delete document
  await db.delete(documents).where(eq(documents.id, id));
}

// ==================== EMBEDDINGS ====================

export async function createEmbedding(embedding: InsertEmbedding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(embeddings).values(embedding);
  return result[0].insertId;
}

export async function getEmbeddingsByDocument(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(embeddings).where(eq(embeddings.documentId, documentId)).orderBy(embeddings.chunkIndex);
}

export async function getAllEmbeddings() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(embeddings);
}
