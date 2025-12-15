// src/lib/env.ts
// Helper para ler env em runtime (window.__ENV) com fallback para import.meta.env
const w = typeof window !== "undefined" ? (window as any) : {};
const R = (w.__ENV ?? {}) as Record<string, string | undefined>;
const B = (import.meta as any)?.env ?? {}; // fallback p/ dev/build

export const ENV = {
  OAUTH_PORTAL_URL: R.VITE_OAUTH_PORTAL_URL ?? B.VITE_OAUTH_PORTAL_URL ?? "",
  APP_ID:           R.VITE_APP_ID           ?? B.VITE_APP_ID           ?? "orkio-web",
  API_ORIGIN:       R.VITE_API_ORIGIN       ?? B.VITE_API_ORIGIN       ?? "",
  UPLOAD_MAX_MB:    Number(R.VITE_UPLOAD_MAX_MB ?? B.VITE_UPLOAD_MAX_MB ?? "16"),
};

export function ensureAbsoluteUrl(u: string, name: string) {
  if (!u || !/^https?:\/\//i.test(u)) {
    throw new Error(`Config inválida: ${name} precisa ser URL absoluta (ex.: https://api.seudominio.com)`);
  }
  return u.replace(/\/+$/, ""); // remove barra final
}
