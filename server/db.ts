import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, conversations, InsertConversation, messages, InsertMessage } from "../drizzle/schema";
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
  
  const [usersCount] = await db.select({ count: users.id }).from(users);
  const [conversationsCount] = await db.select({ count: conversations.id }).from(conversations);
  const [messagesCount] = await db.select({ count: messages.id }).from(messages);
  
  return {
    totalUsers: usersCount?.count ?? 0,
    totalConversations: conversationsCount?.count ?? 0,
    totalMessages: messagesCount?.count ?? 0,
  };
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
