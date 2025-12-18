import { ENV } from "./_core/runtimeEnv";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Retorna:
 * - URL absoluta para o portal OAuth (quando configurado)
 * - OU rota interna "/login" (fallback seguro), para não derrubar o app no Pages
 */
export const getLoginUrl = () => {
  // Preferir ENV (runtime safe), mas manter compatível com import.meta.env
  const oauthPortalUrl =
    ENV?.VITE_OAUTH_PORTAL_URL || import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = ENV?.VITE_APP_ID || import.meta.env.VITE_APP_ID;

  // Se OAuth estiver desabilitado ou não configurado, volta para login interno
  const oauthDisabled =
    Boolean(ENV?.VITE_DISABLE_OAUTH) ||
    String(import.meta.env.VITE_DISABLE_OAUTH || "").toLowerCase() === "true";

  if (oauthDisabled || !oauthPortalUrl || !appId) {
    return "/login";
  }

  // Backend/API origem (para callback correto quando o front está em GitHub Pages)
  const apiOrigin =
    ENV?.VITE_API_ORIGIN ||
    ENV?.API_ORIGIN ||
    import.meta.env.VITE_API_ORIGIN ||
    window.location.origin;

  const apiBase = String(apiOrigin).replace(/\/+$/, "");
  const redirectUri = `${apiBase}/api/oauth/callback`;
  const state = btoa(redirectUri);

  // ✅ FIX: new URL com base, e garantir que oauthPortalUrl seja válido
  const base = oauthPortalUrl.endsWith("/")
    ? oauthPortalUrl
    : `${oauthPortalUrl}/`;

  const url = new URL("app-auth", base);
  url.searchParams.set("appId", String(appId));
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
