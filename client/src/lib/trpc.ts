import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

function extractBatchIds(body: any): (string | number)[] {
  try {
    if (typeof body === "string") {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => item?.id ?? idx);
      }
    }
  } catch {
    // ignore parse errors
  }
  return [0]; // fallback: single item
}

function makeBatchErrorEnvelope(ids: (string | number)[], message: string, code = "INTERNAL_SERVER_ERROR") {
  return ids.map((id) => ({
    id,
    error: {
      json: { message, code, data: { code, httpStatus: 500 } },
      meta: {},
    },
  }));
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

            // Extract batch IDs from request body
            const ids = extractBatchIds(init?.body);

            // If not JSON or 5xx, return batch error envelope with correct IDs
            if (!looksJson || res.status >= 500) {
              const statusMsg =
                res.status >= 500
                  ? `Service Unavailable (${res.status})`
                  : "Invalid response from server";
              return new Response(JSON.stringify(makeBatchErrorEnvelope(ids, statusMsg)), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }

            return res;
          } catch (e: any) {
            const msg = e?.message || "Network error";
            const ids = extractBatchIds(init?.body);
            return new Response(JSON.stringify(makeBatchErrorEnvelope(ids, msg)), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
        },
      }),
    ],
  });
}
