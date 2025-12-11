import { ENV } from "./_core/env";

export async function health() {
  const out: any = { 
    ok: true, 
    storage: "unknown", 
    embeddings: "unknown",
    env: {
      storageMode: ENV.storageMode,
      forceStorageLocal: ENV.forceStorageLocal,
      debugUploadShortCircuit: ENV.debugUploadShortCircuit,
      ragIngestMode: ENV.ragIngestMode,
      uploadMaxMB: ENV.uploadMaxMB,
    }
  };

  // Storage "ping" - check if storage API is reachable
  try {
    const storageHealthUrl = `${ENV.forgeApiUrl.replace(/\/$/, "")}/health`;
    const res = await fetch(storageHealthUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    out.storage = res.ok ? "healthy" : `down:${res.status}`;
  } catch (e) {
    out.storage = "down";
  }

  // Embeddings "ping" - check if embeddings API is reachable
  try {
    const base = (ENV.embeddingBaseUrl || "").replace(/\/$/, "");
    const url =
      ENV.embeddingProvider === "openai"
        ? "https://api.openai.com/v1/embeddings"
        : `${base}/embeddings`;
    const apiKey =
      ENV.embeddingProvider === "openai"
        ? ENV.openaiApiKey
        : ENV.forgeApiKey;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: ["ping"],
        model: ENV.embeddingModel,
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    out.embeddings = res.ok ? "healthy" : `down:${res.status}`;
  } catch (e) {
    out.embeddings = "down";
  }

  // Overall health: OK only if both storage and embeddings are healthy
  out.ok = out.storage === "healthy" && out.embeddings === "healthy";
  return out;
}
