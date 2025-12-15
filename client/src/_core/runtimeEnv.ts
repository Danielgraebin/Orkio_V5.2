// client/src/_core/runtimeEnv.ts
type FrontEnv = {
  VITE_OAUTH_PORTAL_URL?: string;
  VITE_APP_ID?: string;
  VITE_API_ORIGIN?: string;
  API_ORIGIN?: string;
  VITE_UPLOAD_MAX_MB?: string | number;
  VITE_DISABLE_OAUTH?: string | boolean;
};

function toBool(v: any) {
  return String(v ?? '').toLowerCase() === 'true';
}
function safeUrl(s?: string): string | undefined {
  if (!s || typeof s !== 'string') return undefined;
  try { return new URL(s).toString(); } catch { return undefined; }
}

export function loadEnv() {
  // @ts-ignore
  const raw: FrontEnv = (window as any).__ENV || {};
  return {
    oauthPortalUrl: safeUrl(raw.VITE_OAUTH_PORTAL_URL),
    appId: raw.VITE_APP_ID || 'orkio-web',
    apiOrigin: safeUrl(raw.VITE_API_ORIGIN || raw.API_ORIGIN),
    uploadMaxMB: Number(raw.VITE_UPLOAD_MAX_MB ?? 16) || 16,
    disableOAuth: toBool(raw.VITE_DISABLE_OAUTH),
  };
}
