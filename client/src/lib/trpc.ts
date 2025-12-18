import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@shared/router";

/**
 * Resolve URLs de forma segura em qualquer ambiente:
 * - localhost
 * - Vercel
 * - GitHub Pages (subpath)
 * - reverse proxy
 */
function resolveApiUrl(): string {
  // prioridade 1: variável explícita
  const raw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_TRPC_URL ||
    "";

  const cleaned = String(raw).trim();

  // inválido / placeholder / vazio
  if (
    !cleaned ||
    cleaned === "undefined" ||
    cleaned === "null" ||
    cleaned.startsWith("__")
  ) {
    return new URL("/trpc", window.location.origin).toString();
  }

  // absoluto → usa direto
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  // relativo → resolve pela origem
  return new URL(
    cleaned.startsWith("/") ? cleaned : `/${cleaned}`,
    window.location.origin
  ).toString();
}

/**
 * Cliente tRPC resiliente (NÃO explode com URL inválida)
 */
export function createTRPCClientBase() {
  const url = resolveApiUrl();

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}
