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
  
  // Queue and logs
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ragIngestMode: (process.env.RAG_INGEST_MODE || "inline") as "queue" | "inline",
  logLevel: process.env.LOG_LEVEL || "info",
};
