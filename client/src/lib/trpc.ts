// client/src/lib/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../server/routers";
import superjson from "superjson";

// ⚠️ ajuste o caminho abaixo se seu runtimeEnv.ts estiver em outra pasta
import { ENV } from "../_core/runtimeEnv";

export const trpc = createTRPCReact<AppRouter>();

/** Extrai IDs do batch para conseguirmos devolver envelope de erro válido */
function extractBatchIds(body: unknown): (string | number)[] {
  try {
    if (typeof body === "string" && body.length) {
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) {
        return parsed.map((op, idx) => (op?.id ?? idx)) as (string | number)[];
      }
      if (parsed && typeof parsed === "object" && "id" in parsed) {
        // quando for uma chamada única
        // @ts-expect-error parse leve
        return [parsed.id as string | number];
      }
    }
  } catch {
    // ignore
  }
  // fallback: pelo menos 1 item para o cliente não quebrar
  return [0];
}

/** Cria envelope de erro no formato batch que o tRPC espera */
function makeBatchErrorEnvelope(
  ids: (string | number)[],
  message: string,
  code: string = "INTERNAL_SERVER_ERROR",
  httpStatus = 500
) {
  return ids.map((id) => ({
    id,
    error: {
      json: { message, code, data: { code, httpStatus } },
      meta: {},
    },
  }));
}

export function createTRPCClientBase() {
  // monta a URL base a partir do runtime env quando disponível
  const base = ENV.apiOrigin ? `${ENV.apiOrigin}/api/trpc` : "/api/trpc";

  return trpc.createClient({
    transformer: superjson, // o transformer deve ser configurado no client
    links: [
      httpBatchLink({
        url: base,
        fetch: async (input, init) => {
          // sempre enviar cookies/sessão
          const initWithCreds: RequestInit = {
            ...(init ?? {}),
            credentials: "include",
          };

          // preserva os IDs do batch (para responder JSON válido mesmo em 5xx/HTML)
          const ids = extractBatchIds(init?.body as unknown);

          try {
            const res = await fetch(input, initWithCreds);

            const ct = res.headers.get("content-type") || "";
            const isJson = ct.includes("application/json");

            // Se o proxy/servidor devolver HTML ou 5xx, convertemos em JSON de batch
            if (!isJson || res.status >= 500) {
              const msg =
                res.status >= 500
                  ? `Service Unavailable (${res.status})`
                  : "Invalid response from server";
              return new Response(
                JSON.stringify(makeBatchErrorEnvelope(ids, msg, "INTERNAL_SERVER_ERROR", res.status || 500)),
                { status: 200, headers: { "content-type": "application/json" } }
              );
            }

            return res;
          } catch (err: any) {
            const msg = err?.message || "Network error";
            return new Response(
              JSON.stringify(makeBatchErrorEnvelope(ids, msg)),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }
        },
      }),
    ],
  });
}

