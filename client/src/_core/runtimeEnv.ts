// client/src/_core/runtimeEnv.ts

// (opcional) ajuda o TS a conhecer import.meta.env do Vite
/// <reference types="vite/client" />

type FrontEnv = {
  VITE_OAUTH_PORTAL_URL?: string;
  VITE_APP_ID?: string;
  VITE_API_ORIGIN?: string;
  API_ORIGIN?: string;
  VITE_UPLOAD_MAX_MB?: string | number;
  VITE_DISABLE_OAUTH?: string | boolean;
};

function toBool(v: any): boolean {
  return String(v ?? '').toLowerCase() === 'true';
}

function safeUrl(s?: string): string | undefined {
  if (!s || typeof s !== 'string') return undefined;
  try { return new URL(s).toString(); } catch { return undefined; }
}

export function loadEnv(): FrontEnv {
  // 1) runtime (injetado por /config.js em produção)
  const rt: any = (globalThis as any).window?._ENV ?? {};
  // 2) build-time (Vite)
  const vite: any = (import.meta as any).env ?? {};

  const VITE_OAUTH_PORTAL_URL = rt.VITE_OAUTH_PORTAL_URL ?? vite.VITE_OAUTH_PORTAL_URL;
  const VITE_APP_ID          = rt.VITE_APP_ID ?? vite.VITE_APP_ID;
  const VITE_API_ORIGIN      = rt.VITE_API_ORIGIN ?? vite.VITE_API_ORIGIN;
  const API_ORIGIN           = rt.API_ORIGIN ?? vite.API_ORIGIN;
  const VITE_UPLOAD_MAX_MB   = rt.VITE_UPLOAD_MAX_MB ?? vite.VITE_UPLOAD_MAX_MB;
  const VITE_DISABLE_OAUTH   = rt.VITE_DISABLE_OAUTH ?? vite.VITE_DISABLE_OAUTH;

  return {
    VITE_OAUTH_PORTAL_URL: safeUrl(VITE_OAUTH_PORTAL_URL),
    VITE_APP_ID,
    VITE_API_ORIGIN: safeUrl(VITE_API_ORIGIN),
    API_ORIGIN: safeUrl(API_ORIGIN),
    VITE_UPLOAD_MAX_MB,
    VITE_DISABLE_OAUTH: toBool(VITE_DISABLE_OAUTH),
  };
}

// 👉 export **nomeado** que o trpc.ts espera
export const ENV = loadEnv();

// útil para tipagem em outros pontos
export type { FrontEnv };
