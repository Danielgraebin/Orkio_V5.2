import { trpc, createTRPCClientBase } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

/**
 * Resolve URLs internas respeitando o BASE_URL do Vite (GitHub Pages / subpath).
 * Ex.: BASE_URL="/Orkio_V5.2/" e path="/login" -> "/Orkio_V5.2/login"
 */
const withBaseUrl = (path: string) => {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, ""); // remove trailing /
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}` || p;
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  // getLoginUrl() geralmente retorna algo como "/login"
  // No GitHub Pages precisamos respeitar o BASE_URL (ex.: "/Orkio_V5.2/")
  window.location.href = withBaseUrl(getLoginUrl());
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Use resilient tRPC client that handles HTML/503 responses
const trpcClient = createTRPCClientBase();

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      {/* ✅ GitHub Pages: app roda em subpasta, então precisa basename */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </trpc.Provider>
);
