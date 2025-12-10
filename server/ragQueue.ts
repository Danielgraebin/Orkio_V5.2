/**
 * BullMQ queue for asynchronous RAG document processing
 * Requires Redis to be running
 * Only initialized when ENV.ragIngestMode === 'queue'
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { ENV } from "./_core/env";

let _ragQueue: Queue | null = null;
let _connection: IORedis | null = null;

export function getRagQueue(): Queue {
  if (!_ragQueue) {
    // Create Redis connection
    _connection = new IORedis(ENV.redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      lazyConnect: true, // Don't connect immediately
    });

    // Create RAG ingest queue
    _ragQueue = new Queue("rag-ingest", { 
      connection: _connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Handle connection errors
    _connection.on("error", (err) => {
      console.error("[ragQueue] Redis connection error:", err.message);
    });

    _connection.on("connect", () => {
      console.log("[ragQueue] Redis connected");
    });
    
    // Connect now
    _connection.connect().catch(err => {
      console.error("[ragQueue] Failed to connect to Redis:", err.message);
    });
  }
  
  return _ragQueue;
}

// Export for backward compatibility
export const ragQueue = {
  add: (...args: Parameters<Queue['add']>) => getRagQueue().add(...args),
};
