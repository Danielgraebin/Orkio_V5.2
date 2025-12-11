// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from "./env";
import fs from "fs";
import path from "path";

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function putLocal(rel: string, buf: Buffer) {
  const root = path.resolve(ENV.uploadDir);
  ensureDir(root);
  const abs = path.join(root, rel);
  ensureDir(path.dirname(abs));
  await fs.promises.writeFile(abs, buf);
  return { url: `/uploads/${rel}` };
}

async function putForge(rel: string, buf: Buffer, mime: string) {
  const base = (ENV.forgeApiUrl || "").replace(/\/$/, "");
  const res = await fetch(`${base}/storage/upload`, {
    method: "POST",
    headers: {
      "Content-Type": mime || "application/octet-stream",
      Authorization: `Bearer ${ENV.forgeApiKey}`,
      "X-File-Path": rel,
    },
    body: buf as any,
  });
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  if (!res.ok) {
    const raw = isJson ? await res.json().catch(()=>({})) : { raw: await res.text().catch(()=> "") };
    throw new Error(`forge ${res.status} ${isJson ? (raw?.message||"error") : "non-JSON"}`);
  }
  const jsonData = isJson ? await res.json() : null;
  if (!jsonData?.url) throw new Error("forge: missing url");
  return { url: jsonData.url as string };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  
  if (ENV.storageMode === "forge") {
    try { return { key, ...await putForge(key, buf, contentType) }; }
    catch { return { key, ...await putLocal(key, buf) }; } // failover
  }
  return { key, ...await putLocal(key, buf) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
