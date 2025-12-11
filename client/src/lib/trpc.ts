import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

function safeJsonError(e: unknown) {
  // Returns a predictable object for toast/error
  return {
    message:
      e instanceof Error
        ? e.message
        : typeof e === "string"
        ? e
        : "Unexpected network error",
  };
}

export function createTRPCClientBase() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        // 🔹 Fetch that "sanitizes" non-JSON responses (e.g., 503 HTML from proxy)
        fetch: async (input, init) => {
          try {
            const res = await fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });

            // If 502/503/504 or Content-Type not JSON → create TRPC-like error
            const ct = res.headers.get("content-type") || "";
            const isJson = ct.includes("application/json");
            if (!isJson || res.status >= 500) {
              const text = await res.text().catch(() => "");
              const msg =
                res.status >= 500
                  ? `Service Unavailable (${res.status})`
                  : "Invalid response from server";
              // Simulate JSON response so tRPC client doesn't break with "Unexpected token…"
              return new Response(
                JSON.stringify({
                  error: { code: "INTERNAL_SERVER_ERROR", message: msg, raw: text.slice(0, 200) },
                }),
                { status: 200, headers: { "content-type": "application/json" } }
              );
            }

            return res;
          } catch (e) {
            // Network failures/fetch timeouts
            return new Response(JSON.stringify({ error: safeJsonError(e) }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
        },
      }),
    ],
  });
}
