import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

function makeBatchErrorEnvelope(message: string, code = "INTERNAL_SERVER_ERROR") {
  // tRPC batch: array of items { error: { json: { message, code }, meta? } }
  return [
    {
      error: {
        json: { message, code },
        meta: {},
      },
    },
  ];
}

export function createTRPCClientBase() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch: async (input, init) => {
          try {
            const res = await fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });

            const ct = res.headers.get("content-type") || "";
            const looksJson = ct.includes("application/json");

            // If not JSON or 5xx, return batch error envelope
            if (!looksJson || res.status >= 500) {
              const statusMsg =
                res.status >= 500
                  ? `Service Unavailable (${res.status})`
                  : "Invalid response from server";
              return new Response(JSON.stringify(makeBatchErrorEnvelope(statusMsg)), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }

            return res;
          } catch (e: any) {
            const msg = e?.message || "Network error";
            return new Response(JSON.stringify(makeBatchErrorEnvelope(msg)), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
        },
      }),
    ],
  });
}
