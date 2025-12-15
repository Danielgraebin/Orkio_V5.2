// client/src/_core/env.ts
import { loadEnv as loadFrontEnv } from "./_essential/runtimeEnv";

const FRONT = loadFrontEnv();

// Normaliza: garante tipos e valores padrão seguros
export const ENV = {
  oauthPortalUrl: FRONT.VITE_OAUTH_PORTAL_URL || "",
  appId: FRONT.VITE_APP_ID || "orkio-web",
  apiOrigin:
    FRONT.API_ORIGIN ||
    FRONT.VITE_API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    "", // pode ficar vazio, o código consumidor precisa lidar com isso
  uploadMaxMB:
    typeof FRONT.VITE_UPLOAD_MAX_MB === "number"
      ? FRONT.VITE_UPLOAD_MAX_MB
      : Number(FRONT.VITE_UPLOAD_MAX_MB || 16),
  disableOAuth:
    typeof FRONT.VITE_DISABLE_OAUTH === "boolean"
      ? FRONT.VITE_DISABLE_OAUTH
      : String(FRONT.VITE_DISABLE_OAUTH || "").toLowerCase() === "true",
} as const;
