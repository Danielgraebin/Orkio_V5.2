/**
 * RAG (Retrieval-Augmented Generation) helper functions
 * Handles document processing, chunking, embedding, and vector search
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { ENV } from "./_core/env";
import { generateEmbeddings } from "./_core/embeddings";
import { logger } from "./_core/logger";
// Lazy load heavy dependencies to reduce memory usage during startup

/**
 * Extract text from different file formats
 */
export async function extractText(content: string, mimeType: string): Promise<string> {
  try {
    // Handle plain text
    if (mimeType === "text/plain" || mimeType === "text/markdown") {
      return Buffer.from(content, 'base64').toString('utf-8');
    }

    // Handle PDF
    if (mimeType === "application/pdf") {
      const buffer = Buffer.from(content, 'base64');
      const pdfParse = await import("pdf-parse");
      const data = await (pdfParse as any).default(buffer);
      return data.text;
    }

    // Handle DOCX
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const buffer = Buffer.from(content, 'base64');
      const mammoth = await import("mammoth");
      const result = await mammoth.default.extractRawText({ buffer });
      return result.value;
    }

    // Fallback: try to decode as text
    return Buffer.from(content, 'base64').toString('utf-8');
  } catch (error) {
    throw new Error(`Failed to extract text from ${mimeType}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Chunk text into smaller pieces for embedding
 */
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embeddings for text using unified embeddings provider
 * Returns a vector (array of numbers)
 * Includes retry logic for transient failures
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const embeddings = await generateEmbeddings([text]);
      return embeddings[0];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn("rag.embedding.retry", {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        error: lastError.message,
      });
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new Error(`Failed to generate embedding after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Process document: extract text, chunk, and embed
 */
export async function processDocument(documentId: number, content: string, mimeType: string): Promise<void> {
  try {
    console.log(`[RAG] Processing document ${documentId} (${mimeType})...`);
    
    // Extract text from document
    const text = await extractText(content, mimeType);
    console.log(`[RAG] Extracted ${text.length} characters from document ${documentId}`);

    if (!text || text.trim().length === 0) {
      throw new Error("No text extracted from document");
    }

    // Chunk the document
    const chunks = chunkText(text);
    console.log(`[RAG] Generated ${chunks.length} chunks for document ${documentId}`);

    if (chunks.length === 0) {
      throw new Error("No chunks generated from document");
    }

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[RAG] Generating embedding for chunk ${i + 1}/${chunks.length}...`);
      const embedding = await generateEmbedding(chunk);

      // Store embedding
      await db.createEmbedding({
        documentId,
        chunkIndex: i,
        content: chunk,
        embedding: JSON.stringify(embedding),
      });
    }
    
    console.log(`[RAG] Document ${documentId} processed successfully with ${chunks.length} embeddings`);
  } catch (error) {
    console.error(`[RAG] Document processing failed for ${documentId}:`, error);
    throw new Error(`Document processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Search for relevant chunks using vector similarity
 */
export async function searchRelevantChunks(
  query: string,
  collectionIds: number[],
  topK: number = 5
): Promise<Array<{ content: string; score: number; documentId: number }>> {
  console.log(`[RAG] Searching for relevant chunks in collections: ${collectionIds.join(", ")}`);
  
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Get all embeddings from specified collections
  const allEmbeddings = await db.getAllEmbeddings();
  console.log(`[RAG] Total embeddings in database: ${allEmbeddings.length}`);

  // Filter embeddings by collection
  const documents = await Promise.all(
    collectionIds.map(id => db.getDocumentsByCollection(id))
  );
  const documentIds = new Set(documents.flat().map(d => d.id));
  console.log(`[RAG] Documents in collections: ${documentIds.size}`);

  const relevantEmbeddings = allEmbeddings.filter(e => documentIds.has(e.documentId));
  console.log(`[RAG] Relevant embeddings found: ${relevantEmbeddings.length}`);

  // Calculate similarity scores
  const scored = relevantEmbeddings.map(e => {
    const embedding = JSON.parse(e.embedding);
    const score = cosineSimilarity(queryEmbedding, embedding);
    return {
      content: e.content,
      score,
      documentId: e.documentId,
    };
  });

  // Sort by score and return top K
  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, topK);
  console.log(`[RAG] Returning top ${topResults.length} chunks (scores: ${topResults.map(r => r.score.toFixed(3)).join(", ")})`);
  
  return topResults;
}

/**
 * Build RAG context from relevant chunks
 */
export function buildRAGContext(chunks: Array<{ content: string; score: number }>): string {
  if (chunks.length === 0) return "";

  const context = chunks
    .map((chunk, i) => `[Document ${i + 1}] (relevance: ${(chunk.score * 100).toFixed(1)}%)\n${chunk.content}`)
    .join("\n\n");

  return `Here are relevant documents that may help answer the question:\n\n${context}\n\nPlease use the above documents to inform your response.`;
}
