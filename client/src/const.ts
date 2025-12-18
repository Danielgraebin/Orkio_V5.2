import { ENV } from "./_core/runtimeEnv";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * GitHub Pages / subpath-safe + anti-crash:
 * - Nunca explode com "TypeError: URL inválida"
 * - Se OAuth não estiver configurado, cai em /login (rota interna)
 */
export const getLoginUrl = () => {
  const oauthPortalUrl = String(
    ENV?.VITE_OAUTH_PORTAL_URL ?? import.meta.env.VITE_OAUTH_PORTAL_URL ?? ""
  ).trim();

  const appId = String(ENV?.VITE_APP_ID ?? import.meta.env.VITE_APP_ID ?? "").trim();

  const disableOAuth =
    Boolean(ENV?.VITE_DISABLE_OAUTH) ||
    String(import.meta.env.VITE_DISABLE_OAUTH ?? "").toLowerCase() === "true";

  // ✅ Se não tiver OAuth configurado, NÃO tenta montar URL externa
  if (disableOAuth || !oauthPortalUrl || !appId) {
    return "/login";
  }

  const apiOrigin = String(
    ENV?.VITE_API_ORIGIN ??
      ENV?.API_ORIGIN ??
      import.meta.env.VITE_API_ORIGIN ??
      ""
  ).trim();

  const apiBase = (apiOrigin || window.location.origin).replace(/\/+$/, "");
  const redirectUri = `${apiBase}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    // ✅ garante base URL válida mesmo se vier sem http(s)
    const baseUrl =
      oauthPortalUrl.startsWith("http://") || oauthPortalUrl.startsWith("https://")
        ? oauthPortalUrl
        : new URL(oauthPortalUrl, window.location.origin).toString();

    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

    const url = new URL("app-auth", base);
    url.searchParams.set("appId", String(appId));
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (e) {
    // ✅ fallback seguro — evita crash total do app
    console.error("[getLoginUrl] invalid oauthPortalUrl:", oauthPortalUrl, e);
    return "/login";
  }
};
