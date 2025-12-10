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
let _connectionAttempted = false;

/**
 * Get or create RAG queue with lazy connection
 * Only connects to Redis when actually needed (queue mode)
 */
export function getRagQueue(): Queue | null {
  // Only initialize if we're in queue mode
  if (ENV.ragIngestMode !== "queue") {
    return null;
  }

  if (!_ragQueue && !_connectionAttempted) {
    _connectionAttempted = true;
    
    try {
      // Create Redis connection
      _connection = new IORedis(ENV.redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
        lazyConnect: true, // Don't connect immediately
        retryStrategy: (times) => {
          // Stop retrying after 3 attempts
          if (times > 3) {
            console.error("[ragQueue] Max Redis connection retries reached");
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
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

      // Handle connection errors gracefully
      _connection.on("error", (err) => {
        // Don't log if it's just a connection refused (expected when Redis not running)
        if (!err.message.includes("ECONNREFUSED")) {
          console.error("[ragQueue] Redis error:", err.message);
        }
      });

      _connection.on("connect", () => {
        console.log("[ragQueue] Redis connected");
      });
      
      // Connect asynchronously (don't block)
      _connection.connect().catch(err => {
        if (!err.message.includes("ECONNREFUSED")) {
          console.error("[ragQueue] Failed to connect to Redis:", err.message);
        }
      });
    } catch (error) {
      console.error("[ragQueue] Failed to initialize queue:", error);
      _ragQueue = null;
    }
  }
  
  return _ragQueue;
}

// Export for backward compatibility
export const ragQueue = {
  add: (...args: Parameters<Queue['add']>) => {
    const queue = getRagQueue();
    if (!queue) {
      throw new Error("Queue not available - check RAG_INGEST_MODE and Redis connection");
    }
    return queue.add(...args);
  },
};
