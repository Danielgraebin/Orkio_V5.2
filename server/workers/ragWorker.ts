/**
 * BullMQ worker for asynchronous RAG document processing
 * Run this as a separate process: pnpm ts-node server/workers/ragWorker.ts
 */

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { ENV } from "../_core/env";
import * as rag from "../rag";
import * as db from "../db";
import { logger } from "../_core/logger";

// Create Redis connection for worker
const connection = new IORedis(ENV.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Create worker
export const worker = new Worker(
  "rag-ingest",
  async (job: Job) => {
    const { documentId, content, mimeType } = job.data as { 
      documentId: number; 
      content: string; 
      mimeType: string;
    };
    
    logger.info("rag.ingest.start", { 
      documentId, 
      jobId: job.id,
      mimeType,
    });
    
    try {
      // Update status to processing
      await db.updateDocument(documentId, { status: "processing" });
      
      // Process document (extract text, chunk, embed)
      await rag.processDocument(documentId, content, mimeType);
      
      // Update status to completed
      await db.updateDocument(documentId, { status: "completed" });
      
      logger.info("rag.ingest.completed", { 
        documentId, 
        jobId: job.id,
      });
    } catch (err: any) {
      // Update status to failed
      await db.updateDocument(documentId, { status: "failed" });
      
      logger.error("rag.ingest.failed", { 
        documentId, 
        jobId: job.id, 
        error: err?.message || String(err),
      });
      
      throw err; // Re-throw to mark job as failed
    }
  },
  { 
    connection,
    concurrency: 5, // Process up to 5 documents in parallel
  }
);

// Worker event handlers
worker.on("failed", (job, err) => {
  logger.error("rag.worker.failed", { 
    jobId: job?.id, 
    error: err.message,
  });
});

worker.on("completed", (job) => {
  logger.info("rag.worker.completed", { 
    jobId: job.id,
  });
});

worker.on("error", (err) => {
  logger.error("rag.worker.error", { 
    error: err.message,
  });
});

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("rag.worker.shutdown", { signal: "SIGTERM" });
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("rag.worker.shutdown", { signal: "SIGINT" });
  await worker.close();
  process.exit(0);
});

logger.info("rag.worker.started", { 
  redisUrl: ENV.redisUrl,
  concurrency: 5,
});
