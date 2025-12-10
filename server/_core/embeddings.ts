/**
 * Unified embeddings provider with Forge/OpenAI fallback
 * Supports both Manus Forge API and direct OpenAI API
 */

import { ENV } from "./env";
import { logger } from "./logger";

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate embeddings using configured provider (Forge or OpenAI)
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const provider = ENV.embeddingProvider;
  
  try {
    if (provider === "forge") {
      return await generateEmbeddingsForge(texts);
    } else if (provider === "openai") {
      return await generateEmbeddingsOpenAI(texts);
    } else {
      throw new Error(`Unknown embedding provider: ${provider}`);
    }
  } catch (error) {
    logger.error("embeddings.generation.failed", {
      provider,
      textCount: texts.length,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Generate embeddings using Manus Forge API
 */
async function generateEmbeddingsForge(texts: string[]): Promise<number[][]> {
  const baseUrl = ENV.embeddingBaseUrl;
  const model = ENV.embeddingModel;
  const apiKey = ENV.forgeApiKey;

  if (!apiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY not configured");
  }

  const url = `${baseUrl}/embeddings`;
  
  logger.debug("embeddings.forge.request", {
    url,
    model,
    textCount: texts.length,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("embeddings.forge.failed", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(
      `Forge embeddings API error: ${response.status} ${response.statusText}`
    );
  }

  const data: EmbeddingResponse = await response.json();
  
  logger.info("embeddings.forge.success", {
    model: data.model,
    embeddingCount: data.data.length,
    tokens: data.usage.total_tokens,
  });

  return data.data.map((item) => item.embedding);
}

/**
 * Generate embeddings using OpenAI API directly
 */
async function generateEmbeddingsOpenAI(texts: string[]): Promise<number[][]> {
  const apiKey = ENV.openaiApiKey;
  const model = ENV.embeddingModel;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const url = "https://api.openai.com/v1/embeddings";
  
  logger.debug("embeddings.openai.request", {
    model,
    textCount: texts.length,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("embeddings.openai.failed", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(
      `OpenAI embeddings API error: ${response.status} ${response.statusText}`
    );
  }

  const data: EmbeddingResponse = await response.json();
  
  logger.info("embeddings.openai.success", {
    model: data.model,
    embeddingCount: data.data.length,
    tokens: data.usage.total_tokens,
  });

  return data.data.map((item) => item.embedding);
}
