/**
 * RAG (Retrieval-Augmented Generation) helper functions
 * Handles document processing, chunking, embedding, and vector search
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";

/**
 * Chunk text into smaller pieces for embedding
 */
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embeddings for text using LLM
 * Returns a vector (array of numbers)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Use LLM to generate embeddings
  // For now, we'll use a simple hash-based approach
  // In production, you'd use OpenAI embeddings API or similar
  
  // Placeholder: generate a simple embedding vector
  // This should be replaced with actual embedding API call
  const embedding = new Array(384).fill(0).map((_, i) => {
    const hash = text.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, i);
    return Math.sin(hash) * 0.5 + 0.5;
  });

  return embedding;
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
 * Process document: chunk and embed
 */
export async function processDocument(documentId: number, content: string): Promise<void> {
  // Chunk the document
  const chunks = chunkText(content);

  // Generate embeddings for each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk);

    // Store embedding
    await db.createEmbedding({
      documentId,
      chunkIndex: i,
      content: chunk,
      embedding: JSON.stringify(embedding),
    });
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
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Get all embeddings from specified collections
  const allEmbeddings = await db.getAllEmbeddings();

  // Filter embeddings by collection
  const documents = await Promise.all(
    collectionIds.map(id => db.getDocumentsByCollection(id))
  );
  const documentIds = new Set(documents.flat().map(d => d.id));

  const relevantEmbeddings = allEmbeddings.filter(e => documentIds.has(e.documentId));

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
  return scored.slice(0, topK);
}

/**
 * Build RAG context from relevant chunks
 */
export function buildRAGContext(chunks: Array<{ content: string; score: number }>): string {
  if (chunks.length === 0) return "";

  const context = chunks
    .map((chunk, i) => `[Document ${i + 1}]\n${chunk.content}`)
    .join("\n\n");

  return `Here are relevant documents that may help answer the question:\n\n${context}\n\nPlease use the above documents to inform your response.`;
}
