export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  
  // RAG/KB configuration
  maxFilesPerCollection: parseInt(process.env.MAX_FILES_PER_COLLECTION || "20", 10),
  autoAgentKB: (process.env.AUTO_AGENT_KB || "true").toLowerCase() === "true",
  uploadMaxMB: parseInt(process.env.UPLOAD_MAX_MB || "16", 10),
  requestBodyLimitMB: parseInt(process.env.REQUEST_BODY_LIMIT_MB || "20", 10),
  
  // Embeddings configuration
  embeddingProvider: (process.env.EMBEDDING_PROVIDER || "forge") as "forge" | "openai",
  embeddingBaseUrl: process.env.EMBEDDING_BASE_URL || "https://forge.manus.im/v1",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  
  // Queue and logs
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ragIngestMode: (process.env.RAG_INGEST_MODE || "inline") as "queue" | "inline",
  logLevel: process.env.LOG_LEVEL || "info",
  
  // Storage configuration
  storageMode: (process.env.STORAGE_MODE || "local").toLowerCase() as "local" | "forge",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
};
